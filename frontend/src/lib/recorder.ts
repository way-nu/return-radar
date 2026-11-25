// Press-and-hold recorder. Works on Android Chrome (webm/opus) and iOS Safari (mp4). Needs HTTPS on phones.
export async function startRecording(maxMs = 30_000): Promise<{ stop: () => Promise<Blob> }> {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
    const type = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
    const rec = new MediaRecorder(stream, {mimeType: type});
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.start();
    const timer = setTimeout(() => rec.state === "recording" && rec.stop(), maxMs);
    return {
        stop: () =>
            new Promise((resolve) => {
                rec.onstop = () => {
                    clearTimeout(timer);
                    stream.getTracks().forEach((t) => t.stop());
                    resolve(new Blob(chunks, {type}));
                };
                if (rec.state === "recording") rec.stop();
                else rec.onstop?.(new Event("stop"));
            }),
    };
}
