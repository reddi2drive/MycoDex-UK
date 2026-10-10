/* MycoDex Cloud — optional Supabase auth and shared storage configuration.
 * No service_role keys. Data access is enforced by SQL RLS policies.
 */
window.MycoDexCloud = (() => {
  const cfg = window.MYCODEX_SUPABASE || {};
  const configured = Boolean(/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test((cfg.url||'').trim()) && (cfg.publishableKey||'').trim());
  let client = null;
  let currentUser = null;
  let initPromise = null;
  let onChange = () => {};

  // Safari occasionally reports transient network failures as "Load failed".
  // Retry only idempotent requests; do not send duplicate login emails or uploads.
  const delay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
  async function resilientFetch(input,options){
    const method=String(options?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
    const attempts=(method==='GET'||method==='HEAD')?3:1;
    let lastError;
    for(let attempt=0;attempt<attempts;attempt++){
      try{return await fetch(input,options);}
      catch(error){
        lastError=error;
        const transient=/load failed|failed to fetch|networkerror|network request failed|network connection was lost/i.test(String(error?.message||error));
        if(!transient||attempt===attempts-1||!navigator.onLine)throw error;
        await delay(350*(attempt+1));
      }
    }
    throw lastError;
  }

  function loadSDK(){
    if (window.supabase?.createClient) return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async=true;
      script.onload=()=>window.supabase?.createClient?resolve():reject(new Error('Cloud library could not load'));
      script.onerror=()=>reject(new Error('Cloud library unavailable. Check your connection.'));
      document.head.appendChild(script);
    });
  }
  function init(callback){
    onChange=callback||onChange;
    if (!configured) return Promise.resolve(null);
    if (!initPromise) initPromise=(async()=>{
      await loadSDK();
      client=window.supabase.createClient(cfg.url.trim().replace(/\/$/,''),cfg.publishableKey.trim(),{
        global:{fetch:resilientFetch},
        auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}
      });
      client.auth.onAuthStateChange((_event,session)=>{
        const next=session?.user||null;
        if(next?.id!==currentUser?.id){currentUser=next;setTimeout(()=>onChange(currentUser),0);}
      });
      const {data,error}=await client.auth.getSession();
      if(error) throw error;
      currentUser=data.session?.user||null;
      onChange(currentUser);
      return currentUser;
    })().catch(e=>{initPromise=null;throw e;});
    return initPromise;
  }
  // Normal sign-in uses an existing, email-confirmed Supabase Auth account.
  // Passwords are never stored in app code, local storage or GitHub.
  async function signInWithPassword(email,password){
    if(!client)throw new Error('Cloud is not ready.');
    const {data,error}=await client.auth.signInWithPassword({
      email:String(email||'').trim(),
      password
    });
    if(error)throw error;
    if(!data?.user)throw new Error('Supabase did not return a signed-in user.');
    currentUser=data.user;
    onChange(currentUser);
    return data.user;
  }
  // A pre-existing signed-in session can add/change its own password.
  // Supabase's secure-password-change policy may require reauthentication.
  async function setAccountPassword(password){
    if(!client||!currentUser)throw new Error('Sign in first before setting a password.');
    const {data,error}=await client.auth.updateUser({password});
    if(error)throw error;
    return data?.user;
  }
  async function signOut(){
    if(!client)return;
    const {error}=await client.auth.signOut();
    if(error)throw error;
    currentUser=null;
    onChange(null);
  }
  return {configured,init,signInWithPassword,setAccountPassword,signOut,
    get client(){return client;},get user(){return currentUser;}};
})();