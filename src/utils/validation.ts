/**
 * Client and API boundary validation rules
 */

export function validateBiometrics(inputs: {
  age: number;
  heightCm: number;
  weightKg: number;
}): { isValid: boolean; error?: string } {
  if (inputs.age < 13 || inputs.age > 100) {
    return { isValid: false, error: 'Age must be between 13 and 100.' };
  }
  if (inputs.heightCm < 50 || inputs.heightCm > 260) {
    return { isValid: false, error: 'Height must be between 50 cm and 260 cm.' };
  }
  if (inputs.weightKg < 25 || inputs.weightKg > 350) {
    return { isValid: false, error: 'Weight must be between 25 kg and 350 kg.' };
  }
  return { isValid: true };
}

export function validateWorkoutSet(weightKg: number, reps: number): { isValid: boolean; error?: string } {
  if (weightKg < 0 || weightKg > 1000) {
    return { isValid: false, error: 'Weight must be between 0 and 1000 kg.' };
  }
  if (reps < 0 || reps > 500) {
    return { isValid: false, error: 'Reps must be between 0 and 500.' };
  }
  return { isValid: true };
}

export function validateUserMessage(message: string): { isValid: boolean; sanitized: string; error?: string } {
  if (!message || typeof message !== 'string') {
    return { isValid: false, sanitized: '', error: 'Message cannot be empty.' };
  }
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return { isValid: false, sanitized: '', error: 'Message cannot be empty.' };
  }
  if (trimmed.length > 500) {
    return { isValid: false, sanitized: '', error: 'Message exceeds maximum limit of 500 characters.' };
  }
  return { isValid: true, sanitized: trimmed };
}
