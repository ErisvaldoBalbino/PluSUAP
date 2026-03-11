(function () {
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);

        if (response.status === 401) {
            window.location.href = "/login";
        }

        return response;
    };
})();
