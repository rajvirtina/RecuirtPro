/**
 * Renderer Process
 * UI logic for the desktop app
 */

/// <reference path="../types/index.d.ts" />

import { ConsentModal } from './ConsentModal';

let violations: any[] = [];
let consentModal: ConsentModal | null = null;

async function init(): Promise<void> {
  try {
    // Check if user has already accepted consent
    if (!ConsentModal.hasConsent()) {
      // Show consent modal on first launch
      consentModal = new ConsentModal();
      consentModal.onAccepted(() => {
        console.log('✅ Consent accepted, proceeding with app initialization');
        initializeApp();
      });
      consentModal.onDeclined(() => {
        console.log('❌ Consent declined, closing application');
        window.close();
      });
      consentModal.show();
    } else {
      // User has already accepted, proceed normally
      initializeApp();
    }
  } catch (error) {
    console.error('Initialization error:', error);
    updateStatus('error', 'Failed to initialize application');
  }
}

async function initializeApp(): Promise<void> {
  try {
    // Load system info
    const systemInfo = await window.electronAPI.getSystemInfo();
    document.getElementById('systemInfo')!.innerHTML = `
      Platform: ${systemInfo.platform}<br>
      Architecture: ${systemInfo.arch}<br>
      Version: ${systemInfo.version}<br>
      Electron: ${systemInfo.electron}<br>
      Node: ${systemInfo.node}
    `;

    // Load saved config
    const config = await window.electronAPI.getConfig();
    if (config.monitoringEnabled && config.interviewId) {
      showMonitoringControls();
      updateStatus('active', `Monitoring Interview: ${config.interviewId}`);
    } else {
      showConfigForm();
    }

    // Listen for violations
    window.electronAPI.onViolationDetected((violation: any) => {
      handleViolation(violation);
    });

    // Listen for critical warnings
    window.electronAPI.onCriticalWarning((warning: any) => {
      alert(`⚠️ ${warning.title}\n\n${warning.message}`);
    });

    // Listen for update status
    window.electronAPI.onUpdateStatus((status: any) => {
      console.log('Update status:', status);
    });
  } catch (error) {
    console.error('App initialization error:', error);
    updateStatus('error', 'Failed to initialize application');
  }
}

function showConfigForm() {
  document.getElementById('configForm')!.style.display = 'block';
  document.getElementById('monitoringControls')!.style.display = 'none';
}

function showMonitoringControls() {
  document.getElementById('configForm')!.style.display = 'none';
  document.getElementById('monitoringControls')!.style.display = 'block';
}

function updateStatus(type: 'inactive' | 'active' | 'error', message: string) {
  const statusEl = document.getElementById('status')!;
  statusEl.className = `status ${type}`;
  statusEl.textContent = `Status: ${message}`;
}

function handleViolation(violation: any) {
  console.warn('Violation detected:', violation);
  violations.push(violation);

  const violationsEl = document.getElementById('violations')!;
  const item = document.createElement('div');
  item.className = 'violation-item';
  item.innerHTML = `
    <strong>${violation.type}</strong>
    ${violation.processName ? `<br>Process: ${violation.processName}` : ''}
    <div class="violation-time">${new Date(violation.timestamp).toLocaleString()}</div>
  `;
  violationsEl.insertBefore(item, violationsEl.firstChild);

  // Keep only last 10 violations in UI
  while (violationsEl.children.length > 10) {
    violationsEl.removeChild(violationsEl.lastChild!);
  }
}

// Event listeners
document.getElementById('startBtn')!.addEventListener('click', async () => {
  const apiUrl = (document.getElementById('apiUrl') as HTMLInputElement).value;
  const token = (document.getElementById('token') as HTMLInputElement).value;
  const interviewId = (document.getElementById('interviewId') as HTMLInputElement).value;
  const candidateId = (document.getElementById('candidateId') as HTMLInputElement).value;

  if (!apiUrl || !token || !interviewId || !candidateId) {
    alert('Please fill in all fields');
    return;
  }

  updateStatus('inactive', 'Starting monitoring...');

  try {
    const result = await window.electronAPI.startMonitoring({
      apiUrl,
      token,
      interviewId,
      candidateId,
    });

    if (result.success) {
      showMonitoringControls();
      updateStatus('active', `Monitoring Interview: ${interviewId}`);
    } else {
      updateStatus('error', `Failed to start: ${result.error}`);
    }
  } catch (error: any) {
    console.error('Start monitoring error:', error);
    updateStatus('error', `Error: ${error.message}`);
  }
});

document.getElementById('stopBtn')!.addEventListener('click', async () => {
  try {
    const result = await window.electronAPI.stopMonitoring();
    if (result.success) {
      showConfigForm();
      updateStatus('inactive', 'Monitoring stopped');
      violations = [];
      document.getElementById('violations')!.innerHTML = '';
    } else {
      alert(`Failed to stop monitoring: ${result.error}`);
    }
  } catch (error: any) {
    console.error('Stop monitoring error:', error);
    alert(`Error: ${error.message}`);
  }
});

// Initialize app
init();
