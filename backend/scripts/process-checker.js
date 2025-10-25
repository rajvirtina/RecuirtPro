#!/usr/bin/env node

/**
 * Process Checker Script
 * This script checks for prohibited remote desktop applications
 * Run this script and send the output to the proctoring system
 */

const { exec } = require('child_process');
const os = require('os');

const forbiddenApps = [
  'teamviewer',
  'anydesk',
  'ultraviewer',
  'uvnc',
  'tightvnc',
  'realvnc',
  'vnc',
  'logmein',
  'gotomypc',
  'ammyy',
  'supremo',
  'splashtop',
  'dameware',
  'bomgar',
  'beyondtrust',
  'connectwise',
  'screenconnect',
  'remoteutilities',
  'remotepc',
];

function checkWindowsProcesses() {
  return new Promise((resolve, reject) => {
    exec('tasklist /FO CSV /NH', (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }

      const lines = stdout.split('\n');
      const processes = lines
        .filter(line => line.trim())
        .map(line => {
          const match = line.match(/"([^"]+)"/);
          return match ? match[1] : '';
        })
        .filter(Boolean);

      const detected = processes.filter(process => {
        const processLower = process.toLowerCase();
        return forbiddenApps.some(app => processLower.includes(app));
      });

      resolve(detected);
    });
  });
}

function checkMacProcesses() {
  return new Promise((resolve, reject) => {
    exec('ps -A -o comm', (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }

      const processes = stdout.split('\n').filter(line => line.trim());
      const detected = processes.filter(process => {
        const processLower = process.toLowerCase();
        return forbiddenApps.some(app => processLower.includes(app));
      });

      resolve(detected);
    });
  });
}

async function main() {
  try {
    const platform = os.platform();
    let detected = [];

    console.log('Checking for prohibited remote desktop applications...\n');

    if (platform === 'win32') {
      detected = await checkWindowsProcesses();
    } else if (platform === 'darwin' || platform === 'linux') {
      detected = await checkMacProcesses();
    } else {
      console.error('Unsupported platform:', platform);
      process.exit(1);
    }

    const result = {
      timestamp: new Date().toISOString(),
      platform: platform,
      detectedApps: detected,
      allClear: detected.length === 0,
    };

    console.log(JSON.stringify(result, null, 2));

    if (detected.length > 0) {
      console.error('\n❌ PROHIBITED APPLICATIONS DETECTED!');
      console.error('Please close the following applications:\n');
      detected.forEach(app => console.error(`  - ${app}`));
      process.exit(1);
    } else {
      console.log('\n✅ No prohibited applications detected');
      process.exit(0);
    }
  } catch (error) {
    console.error('Error checking processes:', error.message);
    process.exit(1);
  }
}

main();
