'use server'

import { revalidatePath } from 'next/cache';

export async function regenerateRoleplayModsJson() {
  revalidatePath('/roleplay-mods.json');
}
