import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { childProfileService } from '@/services';
import type { ChildAge, ChildGender, ChildProfile } from '@/types/models';

export function useChildProfile() {
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Read again whenever the screen comes back into view, so a name changed elsewhere shows at once.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      childProfileService.getProfile().then((p) => {
        if (active) {
          setProfile(p);
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const save = useCallback(async (input: { name: string; age: ChildAge; gender?: ChildGender; nameMarathi?: string }) => {
    const saved = await childProfileService.saveProfile(input);
    setProfile(saved);
    return saved;
  }, []);

  return { profile, loading, save };
}
