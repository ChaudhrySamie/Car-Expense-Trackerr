import { db } from '../services/firebase';
import { APP_VERSION } from '../constants/appInfo';

export async function checkAppVersion() {
  try {
    const versionDoc = await db.collection('appConfig').doc('versionInfo').get();

    if (!versionDoc.exists) {
      // No config found — assume up to date, don't block or alarm the user
      return { status: 'upToDate', currentVersion: APP_VERSION, latestVersion: APP_VERSION };
    }

    const data = versionDoc.data();
    if (!data) {
       return { status: 'upToDate', currentVersion: APP_VERSION, latestVersion: APP_VERSION };
    }
    const latestVersion = data.latestVersion;

    const isUpToDate = compareVersions(APP_VERSION, latestVersion) >= 0;

    return {
      status: isUpToDate ? 'upToDate' : 'updateAvailable',
      currentVersion: APP_VERSION,
      latestVersion,
      updateMessage: data.updateMessage || null,
      downloadUrl: data.downloadUrl || null,
    };
  } catch (error) {
    console.error('Version check failed:', error);
    // Fail silently — never block the About screen or show an error for this
    return { status: 'upToDate', currentVersion: APP_VERSION, latestVersion: APP_VERSION };
  }
}

// Simple semantic version comparator: returns 1 if a > b, -1 if a < b, 0 if equal
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}
