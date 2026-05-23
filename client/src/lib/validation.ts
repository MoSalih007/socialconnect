export const validatePassword = (password: string): string | null => {
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Must contain uppercase letter';
  if (!/[a-z]/.test(password)) return 'Must contain lowercase letter';
  if (!/\d/.test(password)) return 'Must contain number';
  return null;
};

export const validateUsername = (username: string): string | null => {
  if (username.length < 3 || username.length > 40)
    return 'Username must be 3-40 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return 'Only letters, numbers, and underscores';
  return null;
};

export const validateEmail = (email: string): string | null => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email';
  return null;
};

export const validateImage = (file: File): string | null => {
  const types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!types.includes(file.type)) return 'Must be JPEG, PNG, GIF, or WebP';
  if (file.size > 5 * 1024 * 1024) return 'Image must be under 5 MB';
  return null;
};