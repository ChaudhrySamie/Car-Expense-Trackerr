/**
 * Maps Firebase Auth error codes to user-friendly messages.
 */
export const getFriendlyErrorMessage = (error: any): string => {
  if (!error || !error.code) {
    return 'We could not complete that request. Please try again.';
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
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'The email or password is incorrect. Please try again.';
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
      return 'We could not complete your request. Please try again.';
  }
};

/** Maps Firestore and network errors to safe, user-friendly record messages. */
export const getFriendlyDataErrorMessage = (error: any, action: 'save' | 'update' | 'delete' = 'save'): string => {
  const code = (error?.code || '').replace('firestore/', '');
  const actionText = action === 'save' ? 'save' : action;

  switch (code) {
    case 'validation/amount-out-of-range':
      return 'Enter an amount between 1 and 100,000,000.';
    case 'validation/liters-out-of-range':
      return 'Enter fuel quantity between 0 and 1,000 liters.';
    case 'validation/rate-out-of-range':
      return 'Enter a fuel rate between 0 and 100,000 per liter.';
    case 'validation/odometer-out-of-range':
      return 'Enter an odometer reading between 0 and 10,000,000 km.';
    case 'validation/brand-too-long':
      return 'Oil brand names can contain up to 50 characters.';
    case 'validation/viscosity-too-long':
      return 'Oil viscosity can contain up to 20 characters.';
    case 'permission-denied':
      return `You do not have permission to ${actionText} this record.`;
    case 'unavailable':
    case 'network-request-failed':
      return 'Unable to connect. Please check your internet connection and try again.';
    case 'deadline-exceeded':
      return 'The request took too long. Please try again.';
    case 'resource-exhausted':
      return 'The service is busy right now. Please try again shortly.';
    default:
      return `We could not ${actionText} this record. Please try again.`;
  }
};
