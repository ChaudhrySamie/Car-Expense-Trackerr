/**
 * Maps Firebase Auth error codes to user-friendly messages.
 */
export const getFriendlyErrorMessage = (error: any): string => {
  if (!error || !error.code) {
    return error.message || 'An unexpected error occurred. Please try again.';
  }

  switch (error.code) {
    case 'auth/invalid-email':
      return 'The email address is not valid. Please check and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please sign up instead.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please double-check and try again.';
    case 'auth/email-already-in-use':
      return 'This email address is already in use by another account.';
    case 'auth/operation-not-allowed':
      return 'Email/password accounts are not enabled. Contact admin.';
    case 'auth/weak-password':
      return 'Your password is too weak. Please use at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Please check your internet and try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later or reset your password.';
    case 'auth/internal-error':
      return 'A server error occurred. Please try again in a moment.';
    default:
      // Return the original message if code is unknown, or a generic one
      return error.message || 'Authentication failed. Please check your connection.';
  }
};
