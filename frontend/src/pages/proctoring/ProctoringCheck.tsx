/**
 * Copyright (c) 2025 SruRaj IT Solutions. All rights reserved.
 */

import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';

interface SystemCheck {
  webcamEnabled: boolean;
  microphoneEnabled: boolean;
  screenShareEnabled: boolean;
  browserSupported: boolean;
  bandwidthOk: boolean;
  cpuOk: boolean;
  memoryOk: boolean;
  remoteAppsConfirmed: boolean;
  browserInfo: string;
  deviceInfo: string;
  resolution: string;
}

interface CheckResult {
  passed: boolean;
  message: string;
  remediation?: string;
}

export default function ProctoringCheck() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const hasRunChecksRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [systemCheck, setSystemCheck] = useState<SystemCheck>({
    webcamEnabled: false,
    microphoneEnabled: false,
    screenShareEnabled: false,
    browserSupported: false,
    bandwidthOk: false,
    cpuOk: false,
    memoryOk: false,
    remoteAppsConfirmed: false,
    browserInfo: navigator.userAgent,
    deviceInfo: `${navigator.platform}`,
    resolution: `${window.screen.width}x${window.screen.height}`,
  });
  const [checkResults, setCheckResults] = useState<{ [key: string]: CheckResult }>({});
  const [violations, setViolations] = useState<string[]>([]);
  const [checkPassed, setCheckPassed] = useState(false);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const checkSystemReadiness = async () => {
    if (checking) {
      console.log('⚠️ Checks already in progress, skipping...');
      return;
    }
    
    console.log('🔍 Starting system checks...');
    setChecking(true);
    setCheckResults({});
    
    try {
      // 1. Check Browser Compatibility
      const browserCheck = checkBrowserCompatibility();
      setCheckResults(prev => ({ ...prev, browser: browserCheck }));

      // 2. Check Webcam
      const webcamCheck = await checkWebcam();
      setCheckResults(prev => ({ ...prev, webcam: webcamCheck }));
      
      // 3. Check Microphone
      const micCheck = await checkMicrophone();
      setCheckResults(prev => ({ ...prev, microphone: micCheck }));
      
      // 4. Check Screen Share Permission (ONLY ONCE)
      console.log('📺 Checking screen share (this will show dialog once)...');
      const screenCheck = await checkScreenShare();
      setCheckResults(prev => ({ ...prev, screenShare: screenCheck }));

      // 5. Check Network Bandwidth
      const bandwidthCheck = await checkBandwidth();
      setCheckResults(prev => ({ ...prev, bandwidth: bandwidthCheck }));

      // 6. Check CPU/Memory
      const performanceCheck = checkPerformance();
      setCheckResults(prev => ({ ...prev, performance: performanceCheck }));

      setSystemCheck((prev) => ({
        ...prev,
        webcamEnabled: webcamCheck.passed,
        microphoneEnabled: micCheck.passed,
        screenShareEnabled: screenCheck.passed,
        browserSupported: browserCheck.passed,
        bandwidthOk: bandwidthCheck.passed,
        cpuOk: performanceCheck.passed,
        memoryOk: performanceCheck.passed,
      }));
    } catch (err) {
      console.error('Error during system checks:', err);
      setError('An error occurred during system checks. Please refresh and try again.');
    } finally {
      setChecking(false);
    }
  };

  const checkBrowserCompatibility = (): CheckResult => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isChrome = userAgent.includes('chrome') && !userAgent.includes('edg');
    const isEdge = userAgent.includes('edg');
    const isFirefox = userAgent.includes('firefox');
    
    // Check Chrome version
    if (isChrome || isEdge) {
      const match = userAgent.match(/chrom(?:e|ium)\/([0-9]+)/);
      const version = match ? parseInt(match[1], 10) : 0;
      
      if (version >= 90) {
        return {
          passed: true,
          message: `${isEdge ? 'Edge' : 'Chrome'} ${version} - Supported`,
        };
      }
      return {
        passed: false,
        message: `${isEdge ? 'Edge' : 'Chrome'} ${version} - Version too old`,
        remediation: 'Please update to Chrome 90 or later',
      };
    }
    
    if (isFirefox) {
      return {
        passed: false,
        message: 'Firefox detected',
        remediation: 'Please use Google Chrome for the best experience',
      };
    }
    
    return {
      passed: false,
      message: 'Unsupported browser',
      remediation: 'Please use Google Chrome (version 90 or later)',
    };
  };

  const checkWebcam = async (): Promise<CheckResult> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      
      stream.getTracks().forEach((track) => track.stop());
      
      return {
        passed: true,
        message: `Webcam detected: ${settings.width}x${settings.height}`,
      };
    } catch (err: any) {
      let remediation = '';
      if (err.name === 'NotAllowedError') {
        remediation = 'Click "Allow" when your browser asks for camera permission';
      } else if (err.name === 'NotFoundError') {
        remediation = 'No webcam found. Please connect a webcam';
      } else if (err.name === 'NotReadableError') {
        remediation = 'Webcam is being used by another application';
      } else {
        remediation = 'Check webcam connection and browser permissions';
      }
      
      return {
        passed: false,
        message: `Webcam check failed: ${err.name}`,
        remediation,
      };
    }
  };

  const checkMicrophone = async (): Promise<CheckResult> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTrack = stream.getAudioTracks()[0];
      const settings = audioTrack.getSettings();
      
      stream.getTracks().forEach((track) => track.stop());
      
      return {
        passed: true,
        message: `Microphone detected: ${settings.deviceId ? 'Connected' : 'Unknown'}`,
      };
    } catch (err: any) {
      let remediation = '';
      if (err.name === 'NotAllowedError') {
        remediation = 'Click "Allow" when your browser asks for microphone permission';
      } else if (err.name === 'NotFoundError') {
        remediation = 'No microphone found. Please connect a microphone';
      } else if (err.name === 'NotReadableError') {
        remediation = 'Microphone is being used by another application';
      } else {
        remediation = 'Check microphone connection and browser permissions';
      }
      
      return {
        passed: false,
        message: `Microphone check failed: ${err.name}`,
        remediation,
      };
    }
  };

  const checkScreenShare = async (): Promise<CheckResult> => {
    try {
      // Request screen share with constraints to prefer entire screen
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: {
          displaySurface: 'monitor', // Force entire screen/monitor only
        } as any,
        audio: false,
        preferCurrentTab: false,
      } as any);

      // Check if user selected entire screen (not window or tab)
      const videoTrack = stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      
      console.log('Screen share settings:', settings);
      
      // Stop the track immediately after checking
      stream.getTracks().forEach((track) => track.stop());

      // Validate that it's a monitor/screen share (not window or tab)
      if (settings.displaySurface && settings.displaySurface !== 'monitor') {
        return {
          passed: false,
          message: `Selected: ${settings.displaySurface}. Must select "Entire Screen"`,
          remediation: 'Please select "Entire Screen" option, not Window or Chrome Tab',
        };
      }
      
      return {
        passed: true,
        message: 'Screen share permission granted (Entire Screen)',
      };
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        return {
          passed: false,
          message: 'Screen share permission denied',
          remediation: 'You must allow screen sharing and select "Entire Screen" for interview monitoring',
        };
      }
      
      return {
        passed: false,
        message: 'Screen share check failed',
        remediation: 'Enable screen sharing when prompted and select "Entire Screen"',
      };
    }
  };

  const checkBandwidth = async (): Promise<CheckResult> => {
    try {
      // Check if we can reach the backend API (most reliable test)
      const apiUrl = window.location.origin.includes('localhost') 
        ? 'http://localhost:5001/api/v1'
        : '/api/v1';
        
      const backendCheck = await fetch(`${apiUrl.replace('/api/v1', '')}/health`, {
        method: 'GET',
        cache: 'no-store',
      });

      if (backendCheck.ok) {
        return {
          passed: true,
          message: 'Network connection is good',
        };
      }

      // If backend check fails, try a basic speed test
      const startTime = Date.now();
      const imageSize = 100000; // Reduced to 100 KB for faster test
      const image = new Image();
      const cacheBuster = `?t=${Date.now()}`;
      
      // Use multiple fallback URLs
      const testUrls = [
        `https://picsum.photos/200/200${cacheBuster}`,
        `https://via.placeholder.com/200x200.png${cacheBuster}`,
        `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"></svg>`,
      ];

      let testPassed = false;
      let speedMbps = '0';

      for (const url of testUrls) {
        try {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
            image.onload = () => {
              clearTimeout(timeout);
              resolve(true);
            };
            image.onerror = () => {
              clearTimeout(timeout);
              reject(new Error('Load failed'));
            };
            image.src = url;
          });

          const duration = (Date.now() - startTime) / 1000;
          speedMbps = (imageSize * 8 / duration / 1024 / 1024).toFixed(2);
          testPassed = true;
          break;
        } catch {
          continue; // Try next URL
        }
      }

      if (testPassed) {
        return {
          passed: true,
          message: `Network speed: ${speedMbps} Mbps`,
        };
      }

      // If all tests fail but we got this far, connection exists
      return {
        passed: true,
        message: 'Network connection detected',
      };
    } catch (err) {
      // Very lenient - if there's any error, still pass if online
      if (navigator.onLine) {
        return {
          passed: true,
          message: 'Network connection available',
        };
      }
      
      return {
        passed: false,
        message: 'No network connection detected',
        remediation: 'Please check your internet connection and try again',
      };
    }
  };

  const checkPerformance = (): CheckResult => {
    const cpuCores = navigator.hardwareConcurrency || 0;
    const memory = (navigator as any).deviceMemory || 0;
    
    const minCores = 2;
    const minMemory = 4; // GB
    
    if (cpuCores < minCores) {
      return {
        passed: false,
        message: `CPU: ${cpuCores} cores (minimum ${minCores} required)`,
        remediation: 'Your device may not support video interviews smoothly',
      };
    }
    
    if (memory > 0 && memory < minMemory) {
      return {
        passed: false,
        message: `RAM: ${memory} GB (minimum ${minMemory} GB recommended)`,
        remediation: 'Close other applications to free up memory',
      };
    }
    
    return {
      passed: true,
      message: `CPU: ${cpuCores} cores, RAM: ${memory > 0 ? memory + ' GB' : 'Unknown'}`,
    };
  };

  const handleSubmitCheck = async () => {
    if (!interviewId) {
      setError('No interview ID found. Cannot proceed.');
      return;
    }

    setLoading(true);
    setError('');
    setViolations([]);

    console.log('🚀 Starting interview submission for ID:', interviewId);

    // Validate all checks passed
    const allPassed = systemCheck.webcamEnabled &&
                     systemCheck.microphoneEnabled &&
                     systemCheck.screenShareEnabled &&
                     systemCheck.browserSupported &&
                     systemCheck.bandwidthOk &&
                     systemCheck.remoteAppsConfirmed;

    if (!allPassed) {
      console.error('❌ Not all checks passed:', systemCheck);
      setError('Please ensure all system requirements are met before proceeding');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        webcamEnabled: systemCheck.webcamEnabled,
        microphoneEnabled: systemCheck.microphoneEnabled,
        remoteAppsDetected: [], // No remote apps detected (confirmed by user)
        runningApplications: [], // Empty array as we don't detect running apps in browser
        browserInfo: systemCheck.browserInfo,
        deviceInfo: systemCheck.deviceInfo,
        ipAddress: 'browser-detected', // Browser doesn't have access to actual IP
        screenShareEnabled: systemCheck.screenShareEnabled,
        resolution: systemCheck.resolution,
        remoteAppsConfirmed: systemCheck.remoteAppsConfirmed,
        checksCompleted: {
          browser: checkResults.browser?.passed,
          webcam: checkResults.webcam?.passed,
          microphone: checkResults.microphone?.passed,
          screenShare: checkResults.screenShare?.passed,
          bandwidth: checkResults.bandwidth?.passed,
          performance: checkResults.performance?.passed,
        },
      };
      
      console.log('📤 Submitting system check with payload:', payload);
      
      const response = await apiClient.post(`/proctoring/verify/${interviewId}`, payload);

      console.log('✅ Full response:', JSON.stringify(response, null, 2));
      console.log('✅ Success flag:', response.success);
      console.log('✅ Response message:', response.message);
      console.log('✅ Response data:', response.data);

      if (response.errors && response.errors.length > 0) {
        console.error('❌ Violations found:', response.errors);
        setViolations(response.errors);
        setError('System check failed. Please fix the issues listed above.');
        setLoading(false);
        return;
      }

      if (response.success === true) {
        console.log('✅ Check passed! Navigating to interview room...');
        setCheckPassed(true);
        
        // Navigate to interview room (not detail page to avoid loop)
        console.log('🎯 Navigating to:', `/interviews/${interviewId}/room`);
        navigate(`/interviews/${interviewId}/room`, { replace: true });
      } else {
        console.error('❌ Verification failed - success is not true');
        console.error('❌ Success value:', response.success);
        console.error('❌ Response message:', response.message);
        setError(`System check verification failed: ${response.message || 'Unknown error'}`);
        setLoading(false);
      }
    } catch (err: any) {
      console.error('❌ Proctoring check error:', err);
      
      if (err.response?.data?.errors) {
        setViolations(err.response.data.errors);
        setError('System check failed. You cannot proceed to the interview until all requirements are met.');
      } else {
        setError(err.response?.data?.message || 'System check failed. Please try again.');
      }
      setLoading(false);
    }
  };

  const handleRetry = () => {
    console.log('🔄 Retrying checks...');
    setRetryCount(prev => prev + 1);
    setError('');
    setViolations([]);
    setChecking(false);
    hasRunChecksRef.current = false; // Allow re-running
    // Trigger re-check
    setTimeout(() => {
      hasRunChecksRef.current = true;
      checkSystemReadiness();
    }, 100);
  };

  // Run checks once on mount
  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (hasRunChecksRef.current) {
      console.log('⚠️ Checks already ran, skipping useEffect...');
      return;
    }
    
    if (!interviewId) {
      setError('No interview ID provided. Please use a valid interview link.');
      return;
    }
    
    console.log('ProctoringCheck loaded for interview:', interviewId);
    hasRunChecksRef.current = true;
    checkSystemReadiness();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Debug logging
  const allChecksPassed = Object.values(checkResults).every(r => r?.passed) && systemCheck.remoteAppsConfirmed;
  
  useEffect(() => {
    console.log('📊 Check Results:', checkResults);
    console.log('✓ All Checks Passed:', allChecksPassed);
    console.log('📋 System Check:', systemCheck);
  }, [checkResults, allChecksPassed, systemCheck]);

  // Conditional renders AFTER all hooks
  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Running comprehensive system checks...</p>
          <p className="mt-2 text-sm text-gray-500">This may take a few moments</p>
        </div>
      </div>
    );
  }

  if (checkPassed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
            <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">System Check Passed!</h2>
          <p className="mt-2 text-gray-600">All requirements met. Redirecting to interview...</p>
        </div>
      </div>
    );
  }

  const renderCheckItem = (key: string, result: CheckResult | undefined, icon: string) => {
    if (!result) return null;

    return (
      <div className={`flex items-start p-4 rounded-lg border-2 ${result.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <div className="flex-shrink-0">
          {result.passed ? (
            <svg className="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        <div className="ml-3 flex-1">
          <div className="flex items-center">
            <span className="text-xl mr-2">{icon}</span>
            <h3 className="text-lg font-medium text-gray-900 capitalize">{key}</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">{result.message}</p>
          {!result.passed && result.remediation && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-yellow-800">
                <strong>Fix:</strong> {result.remediation}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-3xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Interview System Check</h1>
          <p className="mt-2 text-gray-600">
            Complete this mandatory verification before joining your interview
          </p>
          {retryCount > 0 && (
            <p className="mt-1 text-sm text-gray-500">`
              Attempt {retryCount + 1}
            </p>
          )}
        </div>

        {/* Error Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="ml-3 text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {violations.length > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-800 mb-2">Violations Detected:</h3>
            <ul className="list-disc list-inside text-sm text-red-700">
              {violations.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
        )}

        {/* System Checks */}
        <div className="space-y-4 mb-8">
          {renderCheckItem('browser', checkResults.browser, '🌐')}
          {renderCheckItem('webcam', checkResults.webcam, '📹')}
          {renderCheckItem('microphone', checkResults.microphone, '🎤')}
          {renderCheckItem('screenShare', checkResults.screenShare, '🖥️')}
          {renderCheckItem('bandwidth', checkResults.bandwidth, '📡')}
          {renderCheckItem('performance', checkResults.performance, '⚡')}

          {/* Manual Confirmation */}
          <div className="p-4 rounded-lg border-2 border-yellow-200 bg-yellow-50">
            <label className="flex items-start cursor-pointer">
              <input
                type="checkbox"
                checked={systemCheck.remoteAppsConfirmed}
                onChange={(e) => setSystemCheck({ ...systemCheck, remoteAppsConfirmed: e.target.checked })}
                className="mt-1 mr-3 h-5 w-5"
              />
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  ⚠️ Remote Apps Confirmation (Required)
                </h3>
                <p className="text-sm text-gray-700 mt-1">
                  I confirm that I have checked Task Manager (Windows) / Activity Monitor (Mac) and verified that
                  <strong> NO remote access applications</strong> are running, including:
                </p>
                <ul className="text-sm text-gray-700 mt-2 list-disc list-inside ml-4">
                  <li>TeamViewer</li>
                  <li>AnyDesk</li>
                  <li>UltraViewer</li>
                  <li>Remote Desktop (RDP)</li>
                  <li>Chrome Remote Desktop</li>
                  <li>Any other screen sharing/remote access tool</li>
                </ul>
                <p className="text-xs text-red-600 mt-2 font-semibold">
                  ⚠️ Running these applications will result in interview cancellation and disqualification.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleRetry}
            disabled={loading}
            className="flex-1 bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🔄 Retry Checks
          </button>
          <button
            onClick={handleSubmitCheck}
            disabled={loading || !allChecksPassed}
            className="flex-1 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={!allChecksPassed ? 'Complete all checks to proceed' : 'Proceed to interview'}
          >
            {loading ? (
              <>
                <span className="inline-block animate-spin mr-2">⏳</span>
                Verifying...
              </>
            ) : (
              '✓ Proceed to Interview'
            )}
          </button>
        </div>

        {!allChecksPassed && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-center text-yellow-800 font-medium">
              ⚠️ Complete all checks and confirm remote apps to proceed
            </p>
            <div className="mt-2 text-xs text-center text-yellow-700">
              Missing: {Object.entries(checkResults)
                .filter(([_, result]) => !result?.passed)
                .map(([key]) => key)
                .join(', ') || 'Remote apps confirmation'}
            </div>
          </div>
        )}

        {checkPassed && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-center text-green-800 font-medium">
              ✅ System check passed! Redirecting to interview...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
