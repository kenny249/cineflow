-- Backfill first_name / last_name for any profiles that have nulls
-- by pulling from auth.users.raw_user_meta_data (populated at signup).
UPDATE public.profiles p
SET
  first_name = COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'first_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'given_name'), '')
  ),
  last_name = COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data->>'last_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data->>'family_name'), '')
  )
FROM auth.users u
WHERE p.id = u.id
  AND p.first_name IS NULL
  AND p.last_name  IS NULL
  AND (
    u.raw_user_meta_data->>'first_name'  IS NOT NULL OR
    u.raw_user_meta_data->>'given_name'  IS NOT NULL OR
    u.raw_user_meta_data->>'last_name'   IS NOT NULL OR
    u.raw_user_meta_data->>'family_name' IS NOT NULL
  );
