(function () {
  console.log('[Token Tracker] Interceptor securely loaded in MAIN world.');

  function estimateTokens(text) {
    if (!text) return 0;
    // rough heuristic: 1 token ~= 4 chars approx
    return Math.floor(text.length / 4);
  }

  function parseForModel(text, url) {
    let m = null;
    try {
      const parsed = JSON.parse(text);
      if (parsed.model) m = parsed.model;
    } catch (e) { }
    if (!m && typeof text === 'string') {
      const match = text.match(/"model"\s*:\s*"([^"]+)"/);
      if (match) m = match[1];
    }
    if (!m && typeof text === 'string') {
      // Search for inner models embedded deeply in unstructured arrays (common in Google's batchexecute)
      const gMatch = text.match(/(gemini[-_ ]?[0-9][a-z0-9\.-]*)/i);
      if (gMatch) m = gMatch[1];
    }
    if (!m && url && url.includes('/models/')) {
      const modelMatch = url.match(/\/models\/([^:]+):/);
      if (modelMatch) m = modelMatch[1];
    }

    return m;
  }

  function report(model, inToks, outToks) {
    console.log('[Token Tracker] Found tokens -> Model:', model, '| Input:', inToks, '| Output:', outToks);
    window.postMessage({
      type: 'TOKEN_TRACKER_DATA',
      payload: { model, inputTokens: inToks, outputTokens: outToks }
    }, '*');
  }

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    let requestTokens = 0;
    let model = null;
    let url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : '');

    // Safety check to ignore analytics to prevent noise
    if (typeof url === 'string' && (url.includes('/analytics') || url.includes('/telemetry') || url.includes('/log'))) {
      return origFetch.apply(this, args);
    }

    // Parse outgoing API request
    if (args[1] && args[1].body && typeof args[1].body === 'string') {
      model = parseForModel(args[1].body, url);
      try {
        const parsed = JSON.parse(args[1].body);
        // Specifically look for chat schemas 
        if (parsed.messages) {
          requestTokens = estimateTokens(JSON.stringify(parsed.messages));
        } else if (parsed.prompt) {
          requestTokens = estimateTokens(JSON.stringify(parsed.prompt));
        } else if (parsed.contents) { // Gemini standard
          requestTokens = estimateTokens(JSON.stringify(parsed.contents));
        } else {
          requestTokens = estimateTokens(args[1].body);
        }
      } catch (e) {
        requestTokens = estimateTokens(args[1].body);
      }

      // Filter out tiny network pings that are not real user prompts
      if (requestTokens > 5) {
        report(model, requestTokens, 0);
      }
    }

    // Apply request
    try {
      const response = await origFetch.apply(this, args);
      const contentType = response.headers.get('content-type') || '';

      // Only track meaningful textual responses (JSON or SSE streams)
      if (contentType.includes('text/event-stream') || contentType.includes('application/json')) {
        const cloned = response.clone();

        if (contentType.includes('text/event-stream') && cloned.body) {
          const reader = cloned.body.getReader();
          const decoder = new TextDecoder('utf-8');
          (async function () {
            let streamTokens = 0;
            let streamModel = null;
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const txt = decoder.decode(value, { stream: true });

                if (!streamModel) {
                  streamModel = parseForModel(txt, url);
                }

                // Accumulate the length of the data events for reliable fallback counting
                if (txt.includes('data: ') && !txt.includes('[DONE]')) {
                  streamTokens += estimateTokens(txt);
                } else if (!txt.includes('event:')) {
                  streamTokens += estimateTokens(txt);
                }
              }
            } catch (ex) { }

            if (streamTokens > 5) report(streamModel, 0, streamTokens);
          })();
        } else {
          cloned.text().then(text => {
            let rTokens = 0;
            let rModel = parseForModel(text, url);
            try {
              const parsed = JSON.parse(text);
              if (parsed.usage && parsed.usage.total_tokens) {
                rTokens = parsed.usage.completion_tokens || estimateTokens(text);
              } else {
                rTokens = estimateTokens(text);
              }
            } catch (e) {
              rTokens = estimateTokens(text);
            }
            if (rTokens > 5) report(rModel, 0, rTokens);
          }).catch(() => { });
        }
      }
      return response;
    } catch (err) {
      throw err;
    }
  };

  const origXHR = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.addEventListener('load', function () {
      if (this.responseText && typeof this.responseText === 'string') {
        if (typeof url === 'string' && (url.includes('/analytics') || url.includes('/telemetry'))) return;
        const rTokens = estimateTokens(this.responseText);
        if (rTokens > 5) {
          report(parseForModel(this.responseText, typeof url === 'string' ? url : ''), 0, rTokens);
        }
      }
    });
    return origXHR.apply(this, [method, url, ...rest]);
  };
})();
