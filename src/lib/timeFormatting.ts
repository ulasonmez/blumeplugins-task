export function formatSavedDuration(seconds: number): string {
    if (seconds <= 0) return "Süre yok";
    
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [];
    if (d > 0) parts.push(`${d} gün`);
    if (h > 0) parts.push(`${h} sa`);
    if (m > 0) parts.push(`${m} dk`);
    if (s > 0) parts.push(`${s} sn`);

    return parts.join(" ");
}

export function formatRunningDuration(seconds: number): string {
    if (seconds < 0) return "00:00:00";
    
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    return [
        h.toString().padStart(2, "0"),
        m.toString().padStart(2, "0"),
        s.toString().padStart(2, "0")
    ].join(":");
}
