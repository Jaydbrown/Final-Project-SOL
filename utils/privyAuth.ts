// src/utils/privyAuth.ts
import { PrivyClient } from "@privy-io/react-auth";

const privy = new PrivyClient({appId: process.env.VITE_PRIVY_APP_ID || ""});

export const handlePrivyAuthResponse = (authResponse: any) => {
    if (!authResponse || !authResponse.user) {
      throw new Error('Invalid authentication response');
    }
  
    const { user, privy_access_token, refresh_token } = authResponse;
  
    // Save tokens to localStorage or a secure storage
    localStorage.setItem('privy_access_token', privy_access_token);
    localStorage.setItem('refresh_token', refresh_token);
  
    return {
      user,
      isNewUser: authResponse.is_new_user || false,
    };
  };