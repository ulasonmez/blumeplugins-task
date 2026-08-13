export function formatDurationShort(seconds: number): string {
    if (seconds <= 0) return "Süre yok";
    if (seconds < 60) return "<1 dk";
    
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        const remainingHours = hours % 24;
        return `${days} gün${remainingHours > 0 ? ` ${remainingHours} sa` : ""}`;
    }
    
    if (hours > 0) {
        const remainingMinutes = minutes % 60;
        return `${hours} sa${remainingMinutes > 0 ? ` ${remainingMinutes} dk` : ""}`;
    }
    
    return `${minutes} dk`;
}

export function formatDurationClock(seconds: number): string {
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
