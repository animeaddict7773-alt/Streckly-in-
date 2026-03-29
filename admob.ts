import { Capacitor } from "@capacitor/core";
import { AdMob, RewardAdPluginEvents, AdLoadInfo } from "@capacitor-community/admob";

const REWARDED_AD_ID = "ca-app-pub-6278223211027037/2927076150";

export const isNative = () => Capacitor.isNativePlatform();

export async function initializeAdMob() {
  if (!isNative()) return;
  await AdMob.initialize({
    requestTrackingAuthorization: true,
    testingDevices: [],
    initializeForTesting: false,
  });
}

export async function showRewardedAd(): Promise<boolean> {
  return new Promise(async (resolve) => {
    let rewardEarned = false;

    const rewardListener = await AdMob.addListener(
      RewardAdPluginEvents.Rewarded,
      () => {
        rewardEarned = true;
      }
    );

    const failedListener = await AdMob.addListener(
      RewardAdPluginEvents.FailedToLoad,
      (_info: AdLoadInfo) => {
        rewardListener.remove();
        failedListener.remove();
        resolve(false);
      }
    );

    const dismissListener = await AdMob.addListener(
      RewardAdPluginEvents.Dismissed,
      () => {
        rewardListener.remove();
        failedListener.remove();
        dismissListener.remove();
        resolve(rewardEarned);
      }
    );

    try {
      await AdMob.prepareRewardVideoAd({
        adId: REWARDED_AD_ID,
        isTesting: false,
      });
      await AdMob.showRewardVideoAd();
    } catch {
      rewardListener.remove();
      failedListener.remove();
      dismissListener.remove();
      resolve(false);
    }
  });
}
