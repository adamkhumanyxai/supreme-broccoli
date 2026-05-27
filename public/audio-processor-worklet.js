// PCM16 mono encoder for Gemini Live input.
// Source AudioContext is configured to 16kHz; we forward Float32 frames as PCM16.
class PCM16Processor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const float32 = input[0]; // mono channel 0
    const pcm16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    this.port.postMessage(pcm16, [pcm16.buffer]);
    return true;
  }
}
registerProcessor("pcm16-processor", PCM16Processor);
