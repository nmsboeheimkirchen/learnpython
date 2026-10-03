/* Shared cancellation at Skulpt suspension boundaries. A cancelled sleep/input
   must never resume old Python code after the learner starts another program. */
(() => {
    let active = null;
    let stopHandler = null;

    function cancel() {
        if (!active || active.cancelled) return;
        active.cancelled = true;
        const error = new Error("Programm abgebrochen.");
        error.name = "KeyboardInterrupt";
        active.error = error;
        active.reject(error);
    }

    async function run(body) {
        if (active) throw new Error("Es läuft bereits ein Python-Programm.");
        const task = { cancelled: false };
        const cancelled = new Promise((_resolve, reject) => { task.reject = reject; });
        active = task;
        const resume = suspension => {
            if (task.cancelled) throw task.error;
            return suspension.resume();
        };
        try {
            const execution = Sk.misceval.asyncToPromise(body, {
                "*": suspension => {
                    if (task.cancelled) return Promise.reject(task.error);
                    if (suspension.data.type === "Sk.promise") {
                        return Promise.race([suspension.data.promise, cancelled]).then(value => {
                            if (task.cancelled) throw task.error;
                            suspension.data.result = value;
                            return resume(suspension);
                        }, error => {
                            if (task.cancelled) throw task.error;
                            suspension.data.error = error;
                            return resume(suspension);
                        });
                    }
                    if (suspension.optional || ["Sk.yield", "Sk.delay"].includes(suspension.data.type)) {
                        return new Promise(resolve => setTimeout(resolve, 0)).then(() => resume(suspension));
                    }
                    // Preserve Skulpt's error for unsupported non-optional types.
                    return null;
                }
            });
            return await Promise.race([execution, cancelled]);
        } finally {
            if (active === task) active = null;
        }
    }

    window.AgentPythonExecution = Object.freeze({
        run, cancel,
        setStopHandler(handler) { stopHandler = handler; }
    });
    document.addEventListener("keydown", event => {
        if (!event.ctrlKey || event.altKey || event.shiftKey || event.key.toLowerCase() !== "c") return;
        if (!stopHandler?.()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    }, true);
})();
