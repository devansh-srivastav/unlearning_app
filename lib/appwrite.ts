export async function logPromptAttempt(prompt: string): Promise<string | null> {
  try {
    const response = await fetch('/api/log-prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to log prompt');
    }
    
    const data = await response.json();
    return data.id || null;
  } catch (error) {
    console.error('Error logging prompt attempt:', error);
    return null;
  }
}
