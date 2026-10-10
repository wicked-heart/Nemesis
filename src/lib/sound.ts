// Sound system disabled per configuration — completely silent interface
class SoundSystem {
  public enabled: boolean = false;

  public toggle(): boolean {
    return false;
  }

  public playHover() {}
  public playClick() {}
  public playPowerUp() {}
  public playSuccess() {}
  public playClueReveal() {}
  public playError() {}
}

export const sounds = new SoundSystem();

