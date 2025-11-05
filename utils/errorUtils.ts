export interface FormattedError {
    timestamp: string;
    code?: string;
    message: string;
    details: string;
}

export const parseError = (error: unknown): FormattedError => {
    const timestamp = new Date().toISOString();
    let code: string | undefined = undefined;
    let message = 'An unexpected error occurred.';
    let details = '';

    if (error instanceof Error) {
        details = error.stack || error.toString();
        const errorMessage = error.message.toLowerCase();

        // Gemini/API specific errors
        if (errorMessage.includes('api key not valid')) {
            code = 'AUTH_001';
            message = 'Invalid API Key. Please verify your key in the settings.';
        } else if (errorMessage.includes('permission denied')) {
            code = 'PERM_001';
            message = 'Permission denied. Please ensure you have granted necessary permissions (e.g., for microphone) and try again.';
        } else if (errorMessage.includes('notallowederror')) {
            code = 'PERM_002';
            message = 'Microphone access was denied. Please enable it in your browser settings to use this feature.';
        } else if (errorMessage.includes('voice api_name') && errorMessage.includes('is not available')) {
            code = 'CONFIG_001';
            message = 'The selected voice is not available for the live conversation model. Please choose another voice in Settings.';
        } else if (errorMessage.includes('invalid_argument') || errorMessage.includes('unsupported image format')) {
            code = 'INPUT_001';
            message = 'The provided file is invalid or in an unsupported format. Please check the file and try again.';
        } else if (errorMessage.includes('400')) {
            code = 'REQ_400';
            message = 'The request was malformed. Please check your input and try again.';
        } else if (errorMessage.includes('429')) {
            code = 'REQ_429';
            message = 'You have exceeded your API quota. Please check your usage and billing or try again later.';
        } else if (errorMessage.includes('500')) {
            code = 'SRV_500';
            message = 'A server-side error occurred. The service may be temporarily unavailable. Please try again later.';
        }
        // Network errors
        else if (errorMessage.includes('network') || errorMessage.includes('failed to fetch')) {
            code = 'NET_001';
            message = 'A network error occurred. Please check your internet connection.';
        }
        // General fallback
        else {
            message = error.message; // Use the original message if it's not one of the known patterns.
        }
    } else if (typeof error === 'string') {
        details = error;
        message = error;
    } else {
        details = JSON.stringify(error, null, 2);
    }
    
    return { timestamp, code, message, details };
};
