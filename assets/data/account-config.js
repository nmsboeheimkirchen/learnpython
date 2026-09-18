// Static Pages remains guest-only. Enable explicitly in the private pilot release.
window.AgentAccountConfig = Object.freeze(window.AgentAccountConfig || {
    enabled: false,
    endpoint: "api/index.php",
    saveMode: "attempts" // or "completion-only": unfinished code stays in this tab only
});
