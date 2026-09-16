-- Hastkatha: content cleanup, removes em dashes from already-seeded blog posts
-- and opportunity descriptions (the 006/005 seed files only insert on first
-- run, so already-live rows need a direct update).
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

update opportunities set description =
  'Free, paperless registration of your craft business as an MSME. Needed for many scheme applications and loans. Only requires Aadhaar.'
where title = 'Udyam Registration (MSME)';

update opportunities set description =
  'India Trade Promotion Organisation: national and international trade fairs and exhibitions where artisans can showcase and sell their work.'
where title = 'ITPO Trade Fairs';

update blogs set
  summary = 'No jargon. What the AI in Hastkatha actually does, in plain language.',
  content = 'AI stands for artificial intelligence. In Hastkatha, it means a computer program that has read millions of pieces of writing and learned patterns in language. Enough to write a new product description, answer a business question, or suggest a price when you give it a few details.

It is not a person, and it does not know your specific craft unless you tell it. Think of it like a very well-read assistant who has never seen your workshop but has read a huge number of business descriptions, marketing posts, and pricing guides. Give it good details, your material, your technique, your story, and it gives back something useful. Give it very little, and it guesses.

It also makes mistakes sometimes. It might get a fact wrong, or suggest a price that does not fit your situation. That is why Hastkatha always shows you the result before it goes anywhere. You review it, edit it if needed, and only then use it.

The AI in Hastkatha runs on two services: Anthropic''s Claude, and a backup called Groq that takes over automatically if the first one is unavailable. You do not need to know or think about this while using the app. It happens behind the scenes so the tools keep working.'
where slug = 'what-is-ai-plain-explanation';

update blogs set
  content = 'When you type your product name and material into the Content page and press Generate, here is what actually happens.

Your text is sent to the AI along with instructions written by Hastkatha, telling it to write like a business assistant who understands handmade craft, to mention the material and technique, and to keep the tone warm rather than corporate. This is why the descriptions come back sounding like they respect your craft, not like a generic online store listing.

The AI then writes a description based on what you gave it. If you only gave a product name, the description will be shorter and more general. If you added the material, the technique, or any detail about how it is made, the description gets richer and more specific, because the AI is working from what you actually told it, not inventing details about your product.

The description is saved to your account so you can find it again later on your home screen, under Recent Creations. Nothing is posted anywhere automatically. You copy it and use it wherever you sell.'
where slug = 'how-hastkatha-writes-descriptions';

update blogs set
  summary = 'Customers buying online cannot touch the fabric or feel the weight. The photo has to do that work.',
  content = 'When a customer sees your craft in person, they can touch the fabric, feel its weight, see how it catches the light. Online, the photo has to do all of that work by itself. This is the single biggest reason similar products sell very differently online. The better photo wins, even when the craft quality is identical.

A plain phone photo on a cluttered background makes a beautiful product look ordinary. A clean, well-lit photo, even of the same exact piece, makes it look like something worth paying more for.

Hastkatha''s Studio tool helps here, but it is important to understand what it does and does not do. It does not edit your exact uploaded photo. It creates a new AI-generated image styled the way you choose: a clean studio background, a festive setting, a model wearing the piece, based on your product''s description. It is a way to see your product presented professionally, useful for social media and marketing, but always review it against the real product before using it in a place where the buyer expects an exact photo, like a formal catalogue.'
where slug = 'why-photos-matter-more-than-ever';

update blogs set
  content = 'AI-generated photoshoot images are a genuinely useful tool, but only if you understand what they are actually doing.

What they can do: take your product''s name and description and generate a new, professional-looking image styled the way you choose, a clean studio look, a festive setting, or a model wearing the garment. This is useful for Instagram posts, WhatsApp catalogues, and general marketing where the goal is to look professional and catch attention.

What they cannot do yet: perfectly reproduce your exact physical product. The AI is imagining a product based on your description, not editing a photo of the real item. Colours, exact patterns, and fine details may differ from what you actually have. This is clearly marked in the app with a preview disclaimer for exactly this reason.

Use AI photoshoots for marketing and social media, where a striking image matters more than pixel-perfect accuracy. For formal catalogues going to serious wholesale buyers, or anywhere a customer will expect the photo to exactly match what they receive, use a real photo of your actual product instead.'
where slug = 'understanding-ai-photoshoots';
