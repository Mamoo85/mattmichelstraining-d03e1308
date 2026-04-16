// PostHog analytics utility
// Public project API key — safe for codebase

const POSTHOG_KEY = "phc_m9XtjipV9b8AKse8J8GU7T4FdoPsPKUa2RPsLDtDBUSx";
const POSTHOG_HOST = "https://us.i.posthog.com";

let initialized = false;

/** Initialize PostHog (call once on app load) */
export function initPostHog() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  // Load PostHog JS snippet
  const script = document.createElement("script");
  script.innerHTML = `
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init('${POSTHOG_KEY}', {
      api_host: '${POSTHOG_HOST}',
      person_profiles: 'identified_only',
      capture_pageview: true,
      capture_pageleave: true,
    });
  `;
  document.head.appendChild(script);
}

/** Track a custom event */
export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window !== "undefined" && (window as any).posthog) {
    (window as any).posthog.capture(event, properties);
  }
}

/** Identify a user (call after login) */
export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (typeof window !== "undefined" && (window as any).posthog) {
    (window as any).posthog.identify(userId, traits);
  }
}

/** Reset identity (call on logout) */
export function resetUser() {
  if (typeof window !== "undefined" && (window as any).posthog) {
    (window as any).posthog.reset();
  }
}
