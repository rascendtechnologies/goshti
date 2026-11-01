/**
 * Stories written ONCE with the child's name left open (see template.ts). They are not part of
 * LIBRARY, so they are never picked at random or shown as ordinary library stories.
 * NOTE: needs a native-Marathi read before any child hears it.
 */
import type { StoryCategory } from '../categories';
import type { AgeBand } from '../profiles';
import type { VoiceStyle } from '../schemas';
import type { SfxId } from '../sfx';

export interface PersonalStory {
  id: string;
  /** May contain placeholders. */
  title: string;
  ageBand: AgeBand;
  category: StoryCategory;
  positiveValue: string;
  voices: Record<string, VoiceStyle>;
  quoteSpeakers: string[];
  ambience?: SfxId;
  /** Story text with placeholders. */
  template: string;
}

export const PERSONAL_STORIES: PersonalStory[] = [
  {
    id: 'kajava-ani-hero',
    title: 'छोटा काजवा आणि {नाव}',
    ageBand: '4-5',
    category: 'bedtime',
    positiveValue: 'मदत करणं',
    voices: { बाळ: 'SMALL_CHILD', काजवा: 'SQUEAKY', काजवे: 'SQUEAKY' },
    quoteSpeakers: ['बाळ', 'काजवा', 'काजवा', 'बाळ', 'बाळ', 'काजवा', 'काजवे', 'काजवा', 'बाळ', 'काजवे'],
    ambience: 'VILLAGE_AMBIENCE',
    template: `रात्र झाली होती. आकाशात चांदण्या चमचम करत होत्या. आजी आणि {नाव} अंगणात बसले होते.

अचानक झुडपात काहीतरी लुकलुक लुकलुक झालं. तिथे एक इवलासा काजवा बसला होता. त्याचा दिवा मिणमिणत होता.

"अरे, तू इथे एकटा का बसला आहेस?" बाळाने विचारलं.

"माझं घर हरवलं," काजवा म्हणाला. "माझे सगळे मित्र त्या मोठ्या झाडावर आहेत. पण मला वाट दिसत नाही."

बाळ हसलं. "काळजी करू नकोस. मी तुला घरी पोहोचवीन."

{नाव+ने} काजव्याला हळूच हातावर घेतलं. मग दोघं चालू लागले. टप टप टप.

पुढे एक छोटा ओढा होता. पाण्यात मोठे मोठे दगड होते. अंधारात दगड दिसत नव्हते.

"आता कसं जायचं?" बाळाने विचारलं.

"थांब, मी माझा दिवा मोठा करतो," काजवा म्हणाला.

लुकलुक! दिवा मोठा झाला. दगड स्पष्ट दिसू लागले. एका एका दगडावर हळूच पाय ठेवत दोघांनी ओढा पार केला.

समोर एक मोठं झाड होतं. त्या झाडावर हजारो काजवे लुकलुक करत होते. "आला! आला! आपला मित्र आला!" सगळे काजवे ओरडले.

छोट्या काजव्याने विचारलं, "तुझं नाव काय?"

बाळ म्हणालं, "माझं नाव {नाव} आहे."

"धन्यवाद, {नाव}! तू आमच्या मित्राला घरी आणलंस," असं सगळे काजवे म्हणाले.

मग सगळे काजवे एकदम चमकले. झाड चांदण्यांसारखं झगमगलं. बाळ टाळ्या वाजवू लागलं.

झोपायची वेळ झाली होती. {नाव+चे} डोळे जड झाले होते. आजीने हळूच जवळ घेतलं.

लुकलुक लुकलुक... काजवे अजूनही चमकत होते. शुभ रात्री, {नाव}!`,
  },
];

export function findPersonalStory(id: string): PersonalStory | undefined {
  return PERSONAL_STORIES.find((s) => s.id === id);
}
