/**
 * Privacy Consent Modal for Desktop App
 * Shown on first launch - requires user acceptance before monitoring begins
 */

export class ConsentModal {
  private modal: HTMLElement | null = null;
  private acceptedCallback: (() => void) | null = null;
  private declinedCallback: (() => void) | null = null;

  constructor() {
    this.createModal();
  }

  private createModal(): void {
    const modalHTML = `
      <div id="consent-modal" class="consent-modal-overlay">
        <div class="consent-modal-container">
          <div class="consent-modal-header">
            <h2>🔒 Privacy & Monitoring Consent</h2>
            <p class="consent-subtitle">RecuirtPro Interview Monitoring System</p>
          </div>

          <div class="consent-modal-body">
            <div class="consent-section">
              <h3>⚠️ Important Information</h3>
              <p>This application monitors your interview session to ensure integrity and fairness. Please read and understand the following:</p>
            </div>

            <div class="consent-section">
              <h3>📹 What We Monitor</h3>
              <ul>
                <li><strong>System Processes:</strong> Running applications and windows</li>
                <li><strong>Screen Activity:</strong> Active window titles and focus changes</li>
                <li><strong>Display Configuration:</strong> Number of monitors and screen sharing status</li>
                <li><strong>System Resources:</strong> CPU and memory usage</li>
                <li><strong>Browser Activity:</strong> Detection of multiple browser instances</li>
              </ul>
            </div>

            <div class="consent-section">
              <h3>🛡️ How We Use This Data</h3>
              <ul>
                <li>Detect unauthorized applications during interviews</li>
                <li>Identify potential cheating or unfair behavior</li>
                <li>Generate violation reports for review</li>
                <li>Ensure equal treatment of all candidates</li>
                <li>Maintain interview integrity and credibility</li>
              </ul>
            </div>

            <div class="consent-section">
              <h3>🔐 Your Privacy Rights</h3>
              <ul>
                <li><strong>Data Access:</strong> You can request a copy of all collected data</li>
                <li><strong>Data Retention:</strong> Monitoring data is kept for 90 days, then automatically deleted</li>
                <li><strong>Data Deletion:</strong> You can request deletion after the interview process</li>
                <li><strong>Transparency:</strong> You'll receive real-time alerts about detected violations</li>
                <li><strong>Human Review:</strong> All automated flags are reviewed by HR before action</li>
              </ul>
            </div>

            <div class="consent-section">
              <h3>⚖️ Your Consent</h3>
              <p class="consent-notice">
                By clicking "I Accept", you acknowledge that you have read and understood this privacy notice 
                and consent to the monitoring of your interview session. This monitoring is necessary to 
                participate in the interview process.
              </p>
              <p class="consent-notice">
                If you decline, the application will close and you will not be able to join the interview. 
                Please contact HR if you have concerns.
              </p>
            </div>

            <div class="consent-checkbox">
              <label>
                <input type="checkbox" id="consent-checkbox">
                <span>I have read and understood the privacy notice and consent to monitoring</span>
              </label>
            </div>
          </div>

          <div class="consent-modal-footer">
            <button id="consent-decline" class="btn-secondary">Decline & Exit</button>
            <button id="consent-accept" class="btn-primary" disabled>I Accept</button>
          </div>

          <div class="consent-modal-links">
            <a href="#" id="full-privacy-policy">View Full Privacy Policy</a>
            <span>•</span>
            <a href="#" id="contact-support">Contact Support</a>
          </div>
        </div>
      </div>
    `;

    const styles = `
      <style>
        .consent-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .consent-modal-container {
          background: #ffffff;
          border-radius: 12px;
          max-width: 700px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          animation: slideUp 0.4s ease;
        }

        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .consent-modal-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 24px;
          text-align: center;
        }

        .consent-modal-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }

        .consent-subtitle {
          margin: 8px 0 0;
          opacity: 0.9;
          font-size: 14px;
        }

        .consent-modal-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }

        .consent-section {
          margin-bottom: 20px;
        }

        .consent-section h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 12px;
          color: #1f2937;
        }

        .consent-section p {
          margin: 0 0 8px;
          color: #4b5563;
          line-height: 1.6;
          font-size: 14px;
        }

        .consent-section ul {
          margin: 8px 0;
          padding-left: 20px;
        }

        .consent-section li {
          margin: 6px 0;
          color: #4b5563;
          line-height: 1.5;
          font-size: 14px;
        }

        .consent-section li strong {
          color: #1f2937;
        }

        .consent-notice {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 12px;
          margin: 12px 0;
          border-radius: 4px;
          font-size: 13px;
        }

        .consent-checkbox {
          background: #f3f4f6;
          padding: 16px;
          border-radius: 8px;
          margin-top: 20px;
        }

        .consent-checkbox label {
          display: flex;
          align-items: center;
          cursor: pointer;
          font-size: 14px;
          color: #1f2937;
        }

        .consent-checkbox input[type="checkbox"] {
          width: 20px;
          height: 20px;
          margin-right: 12px;
          cursor: pointer;
        }

        .consent-modal-footer {
          padding: 20px 24px;
          background: #f9fafb;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          border-top: 1px solid #e5e7eb;
        }

        .btn-primary, .btn-secondary {
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #667eea;
          color: white;
        }

        .btn-primary:not(:disabled):hover {
          background: #5568d3;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-primary:disabled {
          background: #d1d5db;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: white;
          color: #6b7280;
          border: 1px solid #d1d5db;
        }

        .btn-secondary:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .consent-modal-links {
          padding: 16px 24px;
          text-align: center;
          font-size: 13px;
          color: #6b7280;
          background: #f9fafb;
        }

        .consent-modal-links a {
          color: #667eea;
          text-decoration: none;
        }

        .consent-modal-links a:hover {
          text-decoration: underline;
        }

        .consent-modal-links span {
          margin: 0 8px;
        }
      </style>
    `;

    // Insert into document
    document.head.insertAdjacentHTML('beforeend', styles);
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    this.modal = document.getElementById('consent-modal');
    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const checkbox = document.getElementById('consent-checkbox') as HTMLInputElement;
    const acceptBtn = document.getElementById('consent-accept') as HTMLButtonElement;
    const declineBtn = document.getElementById('consent-decline') as HTMLButtonElement;
    const privacyLink = document.getElementById('full-privacy-policy');
    const supportLink = document.getElementById('contact-support');

    // Enable accept button only when checkbox is checked
    checkbox?.addEventListener('change', () => {
      if (acceptBtn) {
        acceptBtn.disabled = !checkbox.checked;
      }
    });

    // Accept button
    acceptBtn?.addEventListener('click', () => {
      if (checkbox?.checked) {
        this.onAccept();
      }
    });

    // Decline button
    declineBtn?.addEventListener('click', () => {
      this.onDecline();
    });

    // Privacy policy link
    privacyLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openPrivacyPolicy();
    });

    // Support link
    supportLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openSupport();
    });
  }

  private onAccept(): void {
    console.log('✅ User accepted privacy consent');
    
    // Store consent in localStorage with timestamp
    const consentData = {
      accepted: true,
      timestamp: new Date().toISOString(),
      version: '1.0',
    };
    localStorage.setItem('privacy-consent', JSON.stringify(consentData));

    // Close modal with animation
    if (this.modal) {
      this.modal.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => {
        this.modal?.remove();
        if (this.acceptedCallback) {
          this.acceptedCallback();
        }
      }, 300);
    }
  }

  private onDecline(): void {
    console.log('❌ User declined privacy consent');
    
    const confirmed = confirm(
      'You must accept the privacy consent to use this application.\n\n' +
      'Declining will close the application. Are you sure?'
    );

    if (confirmed) {
      if (this.declinedCallback) {
        this.declinedCallback();
      } else {
        // Default: close the app
        window.close();
      }
    }
  }

  private openPrivacyPolicy(): void {
    // Open privacy policy in default browser
    alert('Privacy Policy\n\nFor full privacy policy details, please visit:\nhttps://recruitpro.example.com/privacy-policy');
  }

  private openSupport(): void {
    // Show support contact
    alert('Contact Support\n\nEmail: support@recruitpro.example.com\nPhone: +1-XXX-XXX-XXXX');
  }

  /**
   * Show the consent modal
   */
  public show(): void {
    if (this.modal) {
      this.modal.style.display = 'flex';
    }
  }

  /**
   * Hide the consent modal
   */
  public hide(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
  }

  /**
   * Check if user has already accepted consent
   */
  public static hasConsent(): boolean {
    const consentData = localStorage.getItem('privacy-consent');
    if (!consentData) return false;

    try {
      const parsed = JSON.parse(consentData);
      return parsed.accepted === true;
    } catch {
      return false;
    }
  }

  /**
   * Set callback for when user accepts
   */
  public onAccepted(callback: () => void): void {
    this.acceptedCallback = callback;
  }

  /**
   * Set callback for when user declines
   */
  public onDeclined(callback: () => void): void {
    this.declinedCallback = callback;
  }
}
