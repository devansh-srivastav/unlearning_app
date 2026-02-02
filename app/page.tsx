'use client';

import { useState, useEffect } from 'react';
import { getAvailableModels, generateImage, type ModelInfo } from '@/lib/api';
import { logPromptAttempt } from '@/lib/appwrite';

const theme_available = [
  "Abstractionism", "Artist_Sketch", "Blossom_Season", "Bricks", "Byzantine", "Cartoon",
  "Cold_Warm", "Color_Fantasy", "Comic_Etch", "Crayon", "Cubism", "Dadaism", "Dapple",
  "Defoliation", "Early_Autumn", "Expressionism", "Fauvism", "French", "Glowing_Sunset",
  "Gorgeous_Love", "Greenfield", "Impressionism", "Ink_Art", "Joy", "Liquid_Dreams",
  "Magic_Cube", "Meta_Physics", "Meteor_Shower", "Monet", "Mosaic", "Neon_Lines", "On_Fire",
  "Pastel", "Pencil_Drawing", "Picasso", "Pop_Art", "Red_Blue_Ink", "Rust", "Seed_Images",
  "Sketch", "Sponge_Dabbed", "Structuralism", "Superstring", "Surrealism", "Ukiyoe",
  "Van_Gogh", "Vibrant_Flow", "Warm_Love", "Warm_Smear", "Watercolor", "Winter",
];

const class_available = [
  "Architectures", "Bears", "Birds", "Butterfly", "Cats", "Dogs", "Fishes", "Flame", "Flowers",
  "Frogs", "Horses", "Human", "Jellyfish", "Rabbits", "Sandwiches", "Sea", "Statues", "Towers",
  "Trees", "Waterfalls", "Mickey Mouse"
];

export default function Home() {
  const [page, setPage] = useState<'main' | 'unlearning_prompt'>('main');
  const [seed, setSeed] = useState(256);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [usedPrompt, setUsedPrompt] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  
  const [modelFamily, setModelFamily] = useState<string>('');
  const [chosenThemeModel, setChosenThemeModel] = useState<string>('');
  const [chosenClassModel, setChosenClassModel] = useState<string>('');
  const [otherModel, setOtherModel] = useState<string>('');
  
  const [promptMode, setPromptMode] = useState<'preset' | 'free'>('preset');
  const [theme, setTheme] = useState<string>('');
  const [objectClass, setObjectClass] = useState<string>('');
  const [freePrompt, setFreePrompt] = useState<string>('');

  useEffect(() => {
    loadModels();
  }, []);

  const isBackendDownError = (err: unknown): boolean => {
    const msg =
      typeof err === 'object' && err && 'message' in err
        ? String((err as any).message)
        : String(err);
    return (
      msg === 'API_UNAVAILABLE' ||
      msg === 'Failed to fetch models' ||
      msg === 'Failed to generate image'
    );
  };

  const loadModels = async () => {
    try {
      setBackendUnavailable(false);
      setError(null);
      const modelList = await getAvailableModels();
      setModels(modelList);
      
      // Set default model family if available
      if (modelList.length > 0) {
        const original = modelList.find(m => m.category === 'original');
        if (original) {
          setModelFamily('Original');
          setSelectedModel(original.display_name);
        } else if (modelList.some(m => m.category === 'theme')) {
          setModelFamily('Style Unlearned');
        } else if (modelList.some(m => m.category === 'class')) {
          setModelFamily('Character or Object Unlearned');
        }
      }
    } catch (err) {
      console.error('Failed to load models:', err);
      if (isBackendDownError(err)) {
        setBackendUnavailable(true);
        setError(null);
      } else {
        setError('Failed to load models');
      }
    }
  };

  const getSelectedModelDisplayName = (): string | null => {
    if (modelFamily === 'Original') {
      const original = models.find(m => m.category === 'original');
      return original?.display_name || null;
    } else if (modelFamily === 'Style Unlearned') {
      const themeModel = models.find(m => m.raw_name === chosenThemeModel && m.category === 'theme');
      return themeModel?.display_name || null;
    } else if (modelFamily === 'Character or Object Unlearned') {
      const classModel = models.find(m => m.raw_name === chosenClassModel && m.category === 'class');
      return classModel?.display_name || null;
    } else if (modelFamily === 'Other') {
      return otherModel || null;
    }
    return null;
  };

  const handleGenerate = async () => {
    const modelName = getSelectedModelDisplayName();
    if (!modelName) {
      setError('Please select a model.');
      return;
    }

    let prompt: string | null = null;

    if (promptMode === 'preset') {
      if (!theme) {
        setError('Please select a style.');
        return;
      }
      if (!objectClass) {
        setError('Please select an object.');
        return;
      }
      prompt = `A ${objectClass} image in ${theme.replace('_', ' ')} style.`;
    } else {
      if (!freePrompt || !freePrompt.trim()) {
        setError('Please enter a prompt.');
        return;
      }
      prompt = freePrompt.trim();
    }

    setLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const steps = 100;
      const cfg_text = 9.0;
      const H = 512;
      const W = 512;
      const ddim_eta = 0.0;

      const result = await generateImage({
        model_name: modelName,
        prompt: prompt,
        steps: steps,
        cfg_text: cfg_text,
        seed: seed,
        H: H,
        W: W,
        ddim_eta: ddim_eta,
      });

      setGeneratedImage(result.image_url);
      setUsedPrompt(result.prompt);
    } catch (err: any) {
      if (isBackendDownError(err)) {
        setBackendUnavailable(true);
        setError(null);
      } else {
        setError(err.message || 'Failed to generate image');
      }
    } finally {
      setLoading(false);
    }
  };

  const themeModels = models.filter(m => m.category === 'theme');
  const classModels = models.filter(m => m.category === 'class');
  const otherModels = models.filter(m => m.category === 'other');
  const originalModel = models.find(m => m.category === 'original');

  const modelFamilyOptions = [];
  if (originalModel) modelFamilyOptions.push('Original');
  if (themeModels.length > 0) modelFamilyOptions.push('Style Unlearned');
  if (classModels.length > 0) modelFamilyOptions.push('Character or Object Unlearned');
  if (otherModels.length > 0) modelFamilyOptions.push('Other');

  // Update selected model when family or sub-selection changes
  useEffect(() => {
    const modelName = getSelectedModelDisplayName();
    if (modelName) {
      setSelectedModel(modelName);
    }
  }, [modelFamily, chosenThemeModel, chosenClassModel, otherModel, models]);

  if (page === 'unlearning_prompt') {
    return <UnlearningPromptPage onBack={() => setPage('main')} />;
  }

  return (
    <div className="flex min-h-screen bg-[#0e1117] text-white">
      {backendUnavailable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg border border-gray-700 bg-[#0e1117] p-6 shadow-2xl">
            <h2 className="text-2xl font-semibold text-white">Backend is not running</h2>
            <p className="mt-2 text-gray-300">
              Please start the FastAPI server (and tunnel if needed), then retry.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => loadModels()}
                className="px-5 py-2 bg-[#ff4b4b] text-white rounded-md hover:bg-[#ff6b6b]"
              >
                Retry
              </button>
              <button
                onClick={() => setBackendUnavailable(false)}
                className="px-5 py-2 border border-gray-600 rounded-md hover:bg-[#262730] text-white"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Sidebar */}
      <div className="w-80 bg-[#262730] border-r border-gray-700 p-6">
        <h2 className="text-base font-semibold mb-6 text-white">Additional Menu</h2>
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-white">Random seed</label>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(parseInt(e.target.value) || 256)}
            className="w-full px-3 py-2 border border-gray-600 rounded-md bg-[#0e1117] text-white"
            step={1}
          />
        </div>
        <button
          onClick={() => setPage('unlearning_prompt')}
          className="w-full px-4 py-2 bg-[#ff4b4b] text-white rounded-md hover:bg-[#ff6b6b]"
        >
          Prompt for Unlearning
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <h1 className="text-4xl font-bold mb-8 text-white">Machine Unlearning Demo</h1>

        {/* Model Selection */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-white">Model Selection</h2>
          <div className="mb-4">
            <p className="mb-3 text-white">Choose a model for unlearning:</p>
            <div className="flex flex-col gap-3">
              {modelFamilyOptions.map((option) => (
                <label key={option} className="flex items-center text-white cursor-pointer">
                  <input
                    type="radio"
                    name="modelFamily"
                    value={option}
                    checked={modelFamily === option}
                    onChange={(e) => setModelFamily(e.target.value)}
                    className="mr-2 w-4 h-4 accent-[#ff4b4b] cursor-pointer"
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>

          {modelFamily === 'Style Unlearned' && (
            <div className="mb-4">
              <label className="block mb-2 font-medium text-white">Unlearned style model</label>
              <select
                value={chosenThemeModel}
                onChange={(e) => setChosenThemeModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-[#262730] text-white"
              >
                <option value="">Select a style...</option>
                {themeModels
                  .map(m => m.raw_name)
                  .sort()
                  .map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {modelFamily === 'Character or Object Unlearned' && (
            <div className="mb-4">
              <label className="block mb-2 font-medium text-white">Unlearned character or object model</label>
              <select
                value={chosenClassModel}
                onChange={(e) => setChosenClassModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-[#262730] text-white"
              >
                <option value="">Select a class...</option>
                {classModels
                  .map(m => m.raw_name)
                  .sort()
                  .map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {modelFamily === 'Other' && (
            <div className="mb-4">
              <label className="block mb-2 font-medium text-white">Other models</label>
              <select
                value={otherModel}
                onChange={(e) => setOtherModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-[#262730] text-white"
              >
                <option value="">Select a model...</option>
                {otherModels
                  .map(m => m.display_name)
                  .sort()
                  .map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* Prompt Type Selection */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-4 text-white">Prompt Type Selection</h3>
          <p className="mb-3 text-white">Choose a prompt type to generate an image:</p>
          <div className="flex gap-6 mb-6">
            <label className="flex items-center text-white cursor-pointer">
              <input
                type="radio"
                name="promptMode"
                value="preset"
                checked={promptMode === 'preset'}
                onChange={(e) => setPromptMode(e.target.value as 'preset' | 'free')}
                className="mr-2 w-4 h-4 accent-[#ff4b4b] cursor-pointer"
              />
              Preset Style/Character or Object
            </label>
            <label className="flex items-center text-white cursor-pointer">
              <input
                type="radio"
                name="promptMode"
                value="free"
                checked={promptMode === 'free'}
                onChange={(e) => setPromptMode(e.target.value as 'preset' | 'free')}
                className="mr-2 w-4 h-4 accent-[#ff4b4b] cursor-pointer"
              />
              Free Text Prompt
            </label>
          </div>

          {promptMode === 'preset' ? (
            <>
              <div className="mb-6">
                <h4 className="text-xl font-semibold mb-2 text-white">Style</h4>
                <p className="text-sm text-gray-300 mb-3">Choose style</p>
                <div className="flex flex-wrap gap-2">
                  {theme_available.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`px-4 py-2 rounded-full border text-sm ${
                        theme === t
                          ? 'bg-transparent text-[#ff4b4b] border-[#ff4b4b]'
                          : 'bg-transparent text-white border-gray-600 hover:border-[#ff4b4b]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-6">
                <h4 className="text-xl font-semibold mb-2 text-white">Object</h4>
                <p className="text-sm text-gray-300 mb-3">Choose object</p>
                <div className="flex flex-wrap gap-2">
                  {class_available.map((c) => (
                    <button
                      key={c}
                      onClick={() => setObjectClass(c)}
                      className={`px-4 py-2 rounded-full border text-sm ${
                        objectClass === c
                          ? 'bg-transparent text-[#ff4b4b] border-[#ff4b4b]'
                          : 'bg-transparent text-white border-gray-600 hover:border-[#ff4b4b]'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="mb-6">
              <h4 className="text-xl font-semibold mb-2 text-white">Free Text Prompt</h4>
              <textarea
                value={freePrompt}
                onChange={(e) => setFreePrompt(e.target.value)}
                placeholder="Image of sandwitch in Monet style"
                className="w-full px-3 py-2 border border-gray-600 rounded-md h-24 bg-[#262730] text-white"
              />
            </div>
          )}
        </div>

        <div className="border-t border-gray-700 my-6"></div>

        {error && !backendUnavailable && (
          <div className="mb-4 p-4 bg-red-900 border border-red-600 text-red-200 rounded">
            {error}
          </div>
        )}

        {loading && (
          <div className="mb-4 p-4 bg-[#262730] border border-gray-600 rounded-md flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#ff4b4b]"></div>
            <span className="text-white">Generating image...</span>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-6 py-3 bg-[#ff4b4b] text-white rounded-md hover:bg-[#ff6b6b] disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          Generate
        </button>

        {generatedImage && (
          <div className="mt-6">
            <img
              src={generatedImage}
              alt="Generated"
              className="max-w-full rounded-lg shadow-lg"
            />
            <p className="mt-2 text-sm text-gray-300">
              Model: {selectedModel} | Prompt: {usedPrompt}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function UnlearningPromptPage({ onBack }: { onBack: () => void }) {
  const [unlearningPrompt, setUnlearningPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!unlearningPrompt.trim()) {
      setError('Please enter an unlearning description.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await logPromptAttempt(unlearningPrompt);
      if (result) {
        setSuccess(true);
        setUnlearningPrompt('');
      } else {
        setError('Error submitting unlearning prompt.');
      }
    } catch (err: any) {
      setError(err.message || 'Error submitting unlearning prompt.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0e1117] text-white">
      <div className="flex-1 p-8 max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold mb-4 text-white">Prompts for Testing Machine Unlearning</h2>
        <div className="mb-6 text-gray-300">
          <p className="mb-2">
            Please type in prompts that you would like to use for testing whether and how the machine unlearning worked
          </p>
          <p className="mb-2">OR</p>
          <p>
            Imagine that your artwork was included in the training dataset for our AI models, and that we have devised a machine unlearning method to unlearn your style or any Character or Object that are unique to your artwork. Please type in prompts that you would like to use for testing how the machine unlearning worked
          </p>
        </div>

        <div className="mb-6">
          <textarea
            value={unlearningPrompt}
            onChange={(e) => setUnlearningPrompt(e.target.value)}
            placeholder="Add prompt here..."
            className="w-full px-3 py-2 border border-gray-600 rounded-md h-32 bg-[#262730] text-white"
          />
        </div>

        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="px-6 py-2 border border-gray-600 rounded-md hover:bg-[#262730] text-white"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-[#ff4b4b] text-white rounded-md hover:bg-[#ff6b6b] disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting...' : 'Submit'}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-900 border border-red-600 text-red-200 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 p-4 bg-green-900 border border-green-600 text-green-200 rounded">
            Unlearning prompt submitted successfully.
          </div>
        )}
      </div>
    </div>
  );
}
