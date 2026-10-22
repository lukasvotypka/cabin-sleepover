// Entry point so that `node --test tests/js/` works on every Node version. Node 22 and later treat
// the directory argument as a path to a module (older versions scan it), so this file loads the tests.
import("./logic.test.mjs");
