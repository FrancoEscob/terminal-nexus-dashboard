import { sessionManager } from './session-manager';

// Initialize session manager and load existing sessions
let initialized = false;

export async function initializeBackend() {
  if (initialized) return;
  
  console.log('Initializing Terminal Nexus Backend...');
  
  try {
    // Load any existing sessions from database
    await sessionManager.loadExistingSessions();
    
    initialized = true;
    console.log('Backend initialized successfully');
  } catch (error) {
    console.error('Failed to initialize backend:', error);
  }
}

// Auto-initialize when module is imported
initializeBackend();
