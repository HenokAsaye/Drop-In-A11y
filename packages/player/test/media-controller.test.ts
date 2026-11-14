import { describe, expect, it, vi } from 'vitest';

import { MediaController } from '../src/media/media-controller';

describe('MediaController (spec 4.1)', () => {
  it('togglePlay plays when paused and pauses when playing', async () => {
    const video = document.createElement('video');
    const controller = new MediaController(video);

    const playSpy = vi.spyOn(video, 'play').mockResolvedValue(undefined);
    const pauseSpy = vi.spyOn(video, 'pause').mockImplementation(() => {});

    // Initially paused (video.paused is true)
    await controller.togglePlay();
    expect(playSpy).toHaveBeenCalled();

    // Now set paused = false
    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    await controller.togglePlay();
    expect(pauseSpy).toHaveBeenCalled();
  });

  it('seekBy advances and rewinds currentTime within bounds', () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'duration', { value: 100, configurable: true });
    video.currentTime = 50;
    const controller = new MediaController(video);

    controller.seekBy(10);
    expect(video.currentTime).toBe(60);

    controller.seekBy(-20);
    expect(video.currentTime).toBe(40);

    controller.seekBy(-100);
    expect(video.currentTime).toBe(0);

    controller.seekBy(200);
    expect(video.currentTime).toBe(100);
  });

  it('seekTo sets currentTime clamped to [0, duration]', () => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'duration', { value: 60, configurable: true });
    const controller = new MediaController(video);

    controller.seekTo(25);
    expect(video.currentTime).toBe(25);

    controller.seekTo(-5);
    expect(video.currentTime).toBe(0);

    controller.seekTo(120);
    expect(video.currentTime).toBe(60);
  });

  it('changeVolume adjusts volume and unmutes when raised', () => {
    const video = document.createElement('video');
    video.volume = 0.5;
    video.muted = true;
    const controller = new MediaController(video);

    controller.changeVolume(0.2);
    expect(video.volume).toBeCloseTo(0.7);
    expect(video.muted).toBe(false);

    controller.changeVolume(-0.9);
    expect(video.volume).toBe(0);

    controller.changeVolume(2.0);
    expect(video.volume).toBe(1);
  });

  it('toggleMute toggles muted state', () => {
    const video = document.createElement('video');
    video.muted = false;
    const controller = new MediaController(video);

    controller.toggleMute();
    expect(video.muted).toBe(true);

    controller.toggleMute();
    expect(video.muted).toBe(false);
  });

  it('setPlaybackRate sets valid playback rates', () => {
    const video = document.createElement('video');
    const controller = new MediaController(video);

    controller.setPlaybackRate(1.5);
    expect(video.playbackRate).toBe(1.5);

    controller.setPlaybackRate(0); // non-positive should be ignored
    expect(video.playbackRate).toBe(1.5);
  });

  it('toggleFullscreen requests or exits fullscreen', async () => {
    const container = document.createElement('div');
    const video = document.createElement('video');
    container.append(video);
    const controller = new MediaController(video);

    const requestSpy = vi.fn().mockResolvedValue(undefined);
    container.requestFullscreen = requestSpy;
    const exitSpy = vi.fn().mockResolvedValue(undefined);
    document.exitFullscreen = exitSpy;

    await controller.toggleFullscreen(container);
    expect(requestSpy).toHaveBeenCalled();

    // If already fullscreen
    Object.defineProperty(document, 'fullscreenElement', {
      value: container,
      configurable: true,
    });
    await controller.toggleFullscreen(container);
    expect(exitSpy).toHaveBeenCalled();
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
    });
  });

  it('provides getters for playback state', () => {
    const video = document.createElement('video');
    const controller = new MediaController(video);

    expect(controller.isPaused).toBe(true);
    expect(controller.isMuted).toBe(false);
    expect(controller.volume).toBe(1);
    expect(controller.playbackRate).toBe(1);
  });
});
