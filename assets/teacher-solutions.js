// Zentrale Ablage der Lehrer-Musterlösungen.
// Die Werte sind derzeit nur Base64-codiert. Eine kennwortbasierte
// Verschlüsselung kann später ergänzt werden, ohne die Levelseiten anzupassen.
window.TeacherSolutions = (() => {
    const encodedSolutions = Object.freeze({
        mission1_level1: "cHJpbnQoIlZlcmJpbmR1bmcgd2lyZCBoZXJnZXN0ZWxsdC4uLiIp",
        mission1_level2: "aW1wb3J0IHRpbWUKcHJpbnQoIlZlcmJpbmR1bmcgd2lyZCBoZXJnZXN0ZWxsdC4uLiIpCnRpbWUuc2xlZXAoMSk=",
        mission1_level3: "aW1wb3J0IHRpbWUKcHJpbnQoIlZlcmJpbmR1bmcgd2lyZCBoZXJnZXN0ZWxsdC4uLiIpCnRpbWUuc2xlZXAoMSkKYWdlbnRfbmFtZSA9IGlucHV0KCJHaWIgZGVpbmVuIE5hbWVuIGVpbjogIik=",
        mission1_level4: "aW1wb3J0IHRpbWUKcHJpbnQoIlZlcmJpbmR1bmcgd2lyZCBoZXJnZXN0ZWxsdC4uLiIpCnRpbWUuc2xlZXAoMSkKYWdlbnRfbmFtZSA9IGlucHV0KCJHaWIgZGVpbmVuIE5hbWVuIGVpbjogIikKcHJpbnQoIldpbGxrb21tZW4gaW0gU3lzdGVtLCIsIGFnZW50X25hbWUp",
        mission2_level1: "a2FiZWwgPSAicm90IgppZiBrYWJlbCA9PSAicm90IjoKICAgIHByaW50KCJFbnRzY2jDpHJmdCEiKQ==",
        mission2_level2: "a2FiZWwgPSAiYmxhdSIKaWYga2FiZWwgPT0gInJvdCI6CiAgICBwcmludCgiRW50c2Now6RyZnQhIikKZWxzZToKICAgIHByaW50KCJLQUJVTU0iKQ==",
        mission2_level3: "a2FiZWwgPSBpbnB1dCgiV2VsY2hlcyBLYWJlbD8gIikKaWYga2FiZWwgPT0gInJvdCI6CiAgICBwcmludCgiRW50c2Now6RyZnQhIikKZWxpZiBrYWJlbCA9PSAiYmxhdSI6CiAgICBwcmludCgiS3VyenNjaGx1c3MhIikKZWxzZToKICAgIHByaW50KCJLQUJVTU0iKQ==",
        mission3_level1: "dGlwcCA9ICIiCndoaWxlIHRpcHAgIT0gIjEyMyI6CiAgICB0aXBwID0gaW5wdXQoIkNvZGUgZWluZ2ViZW46ICIp",
        mission3_level2: "dGlwcCA9IGludChpbnB1dCgiQ29kZSBlaW5nZWJlbjogIikpCmlmIHRpcHAgPCA1MDoKICAgIHByaW50KCJadSBuaWVkcmlnISIpCmVsaWYgdGlwcCA+IDUwOgogICAgcHJpbnQoIlp1IGhvY2ghIik=",
        mission3_level3: "aW1wb3J0IHJhbmRvbQpnZWhlaW0gPSByYW5kb20ucmFuZGludCgxLCAxMDApCnRpcHAgPSAwCndoaWxlIHRpcHAgIT0gZ2VoZWltOgogICAgdGlwcCA9IGludChpbnB1dCgiQ29kZSBlaW5nZWJlbjogIikpCiAgICBpZiB0aXBwIDwgZ2VoZWltOgogICAgICAgIHByaW50KCJadSBuaWVkcmlnISIpCiAgICBlbGlmIHRpcHAgPiBnZWhlaW06CiAgICAgICAgcHJpbnQoIlp1IGhvY2ghIikKcHJpbnQoIktuYWNrISIp",
        mission4_level1: "bmFjaHJpY2h0ID0gIkdFSEVJTSIKZm9yIGJ1Y2hzdGFiZSBpbiBuYWNocmljaHQ6CiAgICBwcmludChidWNoc3RhYmUp",
        mission4_level2: "bmFjaHJpY2h0ID0gIkdFSEVJTSIKZm9yIGJ1Y2hzdGFiZSBpbiBuYWNocmljaHQ6CiAgICBwcmludChvcmQoYnVjaHN0YWJlKSk=",
        mission4_level3: "bmFjaHJpY2h0ID0gIkdFSEVJTSIKZ2VoZWltdGV4dCA9ICIiCmZvciBidWNoc3RhYmUgaW4gbmFjaHJpY2h0OgogICAgemFobCA9IG9yZChidWNoc3RhYmUpICsgMwogICAgZ2VoZWltdGV4dCA9IGdlaGVpbXRleHQgKyBjaHIoemFobCkKcHJpbnQoZ2VoZWltdGV4dCk=",
        agent_training_level1: "aW1wb3J0IHR1cnRsZQoKZHJvaG5lID0gdHVydGxlLlR1cnRsZSgpCmRyb2huZS5zaGFwZSgidHJpYW5nbGUiKQpkcm9obmUuY29sb3IoIiM3MWVkZjQiKQpkcm9obmUuc3BlZWQoMikKZHJvaG5lLnBlbnVwKCkKCmRyb2huZS5wZW5kb3duKCkKZHJvaG5lLmdvdG8oMTYwLCA4MCkKZHJvaG5lLnBlbnVwKCkKZHJvaG5lLmRvdCgzMCwgIiM3ZGYyYTkiKQpwcmludCgiUG9zaXRpb246IiwgZHJvaG5lLnBvc2l0aW9uKCkp",
        agent_training_level2: "aW1wb3J0IHR1cnRsZQoKZHJvaG5lID0gdHVydGxlLlR1cnRsZSgpCmRyb2huZS5zaGFwZSgidHJpYW5nbGUiKQpkcm9obmUuY29sb3IoIiM3MWVkZjQiKQpkcm9obmUuc3BlZWQoMikKZHJvaG5lLnBlbnVwKCkKCmRlZiBnZWhlX3p1KHgsIHkpOgogICAgZHJvaG5lLmdvdG8oeCwgeSkKCmRlZiBtYXJraWVyZSgpOgogICAgZHJvaG5lLmRvdCgzMCwgIiM3ZGYyYTkiKQoKZ2VoZV96dSgtMTYwLCA0MCkKbWFya2llcmUoKQpnZWhlX3p1KDgwLCAxMzApCm1hcmtpZXJlKCk=",
        agent_training_level3: "aW1wb3J0IHR1cnRsZQoKZHJvaG5lID0gdHVydGxlLlR1cnRsZSgpCmRyb2huZS5zaGFwZSgidHJpYW5nbGUiKQpkcm9obmUuY29sb3IoIiM3MWVkZjQiKQpkcm9obmUuc3BlZWQoMikKZHJvaG5lLnBlbnVwKCkKCmRlZiBnZWhlX3p1KHgsIHkpOgogICAgZHJvaG5lLmdvdG8oeCwgeSkKCmRlZiBtYXJraWVyZSgpOgogICAgZHJvaG5lLmRvdCgzMCwgIiM3ZGYyYTkiKQoKaW52ZW50YXIgPSBbXQoKZ2VoZV96dSgtMjEwLCAtNjUpCm1hcmtpZXJlKCkKZnVuZCA9IGRyb2huZS5zdWNoZV9oaWVyKCkKcHJpbnQoIkdlZnVuZGVuOiIsIGZ1bmQpCmlmIGZ1bmQgPT0gIkRhdGVuY2hpcCI6CiAgICBpbnZlbnRhci5hcHBlbmQoZnVuZCk=",
        agent_training_level3_direct: "aW1wb3J0IHR1cnRsZQoKZHJvaG5lID0gdHVydGxlLlR1cnRsZSgpCmRyb2huZS5zaGFwZSgidHJpYW5nbGUiKQpkcm9obmUuY29sb3IoIiM3MWVkZjQiKQpkcm9obmUuc3BlZWQoMikKZHJvaG5lLnBlbnVwKCkKCmRlZiBnZWhlX3p1KHgsIHkpOgogICAgZHJvaG5lLmdvdG8oeCwgeSkKCmRlZiBtYXJraWVyZSgpOgogICAgZHJvaG5lLmRvdCgzMCwgIiM3ZGYyYTkiKQoKaW52ZW50YXIgPSBbXQoKZ2VoZV96dSgtMjEwLCAtNjUpCm1hcmtpZXJlKCkKZnVuZCA9IGRyb2huZS5zdWNoZV9oaWVyKCkKcHJpbnQoZnVuZCkKaW52ZW50YXIuYXBwZW5kKGZ1bmQp"
    });

    function decodeSolution(encoded) {
        const bytes = Uint8Array.from(window.atob(encoded), character => character.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    }

    function load(levelId) {
        const encoded = encodedSolutions[levelId];
        if (!encoded || !window.editor || typeof window.editor.setValue !== "function") {
            return false;
        }

        window.editor.setValue(decodeSolution(encoded));
        if (typeof window.editor.focus === "function") {
            window.editor.focus();
        }
        return true;
    }

    document.addEventListener("DOMContentLoaded", () => {
        if (window.location.hash.toLowerCase() !== "#l") {
            return;
        }

        document.querySelectorAll("[data-teacher-solution]").forEach(button => {
            button.addEventListener("click", () => load(button.dataset.teacherSolution));
        });
    });

    return Object.freeze({ load });
})();
