-- Hastkatha: cornerstone SEO posts targeting core search/AI-citation topics
-- (digital transformation of artisans, artisan digital skills, traditional
-- handicrafts, government schemes). Written to the same plain-paragraph
-- format as 006_blogs.sql; paragraphs starting with "## " render as H2
-- headings (see app/blog/[slug]/BlogDetailView.tsx).
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

insert into blogs (slug, title, summary, content, category) values
(
  'digital-transformation-of-artisans',
  'What "digital transformation" actually means for an artisan',
  'Not apps for their own sake. What changes in your day, and what does not.',
  '"Digital transformation" gets used as a vague phrase that mostly means "add technology somewhere." For an artisan running a craft business, it means something much narrower and much more useful: a handful of specific changes to how you price, photograph, describe, and sell your work, none of which touch how you actually make it.

## What changes

Three things, mainly. How a buyer first sees your product, usually a photo on a phone screen, before they ever touch the piece. How they understand what they are buying, a description that explains the material and technique, not just a name. And how they find you at all, a public page, a WhatsApp catalogue, a listing on a marketplace, instead of relying only on people walking past a shop or knowing you through word of mouth.

None of this changes the loom, the wheel, the kiln, or the hands doing the work. The craft stays exactly as slow and exact as it needs to be. What moves online is everything around the sale, not the making.

## Why it matters now

A customer buying online cannot touch the fabric or feel the weight of a piece. The photo, the description, and the price have to do that work instead. Two nearly identical products can sell very differently depending on how well that is done, and that gap has only widened as more buying moves to phones and marketplaces rather than physical shops.

This is not entirely new. Artisans have always adapted how they present and sell their work, from local markets to wholesale buyers to government emporiums. Selling online is simply the newest version of the same skill: showing your work to someone who cannot yet hold it.

## Where to actually start

Start with one product, not your whole catalogue. Take one genuinely clean photo of it. Write one description that mentions the material and how it is made. Put a fair price on it that accounts for your time, not just materials. Get that one right, then repeat it for the next product. Trying to digitize everything at once is usually where people give up.',
  'business'
),
(
  'artisan-digital-skills-you-actually-need',
  'The digital skills that actually help you sell, and the ones that do not matter yet',
  'A short, honest list instead of the usual overwhelming one.',
  'There is a long list of things people tell artisans to "learn": social media, e-commerce, SEO, analytics, email marketing. Most of that list is aimed at businesses with a marketing team, not one person running a craft business alone. A much shorter list actually moves the needle.

## The skills that matter

Writing a product description that says what it is, what it is made of, and how it is made, in plain language. That is it. You do not need to be a copywriter. You need to stop assuming the buyer already knows what your craft involves.

Taking or presenting a photo that shows the product clearly, in good light, against a background that does not distract. A phone camera is enough. A cluttered table behind the product is usually the actual problem, not the camera.

Replying to a WhatsApp or Instagram message quickly and clearly, including your price. Many sales are lost not because the product was wrong but because the reply took two days or never mentioned a price at all.

Basic pricing math: separating material cost from labour cost, so a busy week does not accidentally mean you are paid less per hour than a slow one.

## What you can skip, for now

You do not need to learn video editing, run paid ads, or manage multiple social platforms before you have gotten the four skills above solid. Add those later, if and when they actually solve a problem you are having, not because a list somewhere says you should.

## Where AI tools fit in

Tools like the ones in Hastkatha exist to shorten the gap between knowing what you want to say and having it written down well, not to replace your judgment about your own craft. Use them to get a first draft of a description or a professional-looking reference photo, then check it against what you actually know is true about your product before you use it.',
  'ai-tools'
),
(
  'selling-traditional-handicrafts-online',
  'Selling traditional handicrafts online without it feeling like a compromise',
  'The story behind a handmade product is not decoration. Leaving it out is usually the actual mistake.',
  'A common worry among artisans moving online is that it will flatten a handmade product into something generic, another item in an endless scroll, stripped of the story that makes it worth the price. That worry is fair. It is also avoidable, if the story is told deliberately instead of left out.

## The story is not decoration

A machine-made version of almost anything is usually cheaper. The reason someone pays more for a handmade piece is everything the machine cannot do: the specific technique, the region it comes from, the time it took, the person who made it. Leave that out of a listing and you are competing on price against mass production, a fight that is hard to win. Include it, and you are offering something genuinely different.

This does not mean writing a long biography for every product. A sentence or two is usually enough: the technique''s name, where it is from, roughly how long it takes. Specific and short beats vague and long.

## Photos should show the making, not just the made

A photo of the finished product is necessary but not the whole picture. Where it is realistic, a photo of the material before it was worked, or the tool used, adds a kind of proof that a factory listing cannot fake. It does not need to be professional. It needs to be real.

## Pricing honestly

Handmade does not automatically mean expensive, but it should not be priced like machine-made either. Buyers who specifically seek out handicrafts generally understand that labour costs money. Pricing too low to compete with mass-produced alternatives usually just signals that the product is not actually different, even when it is.',
  'marketing'
),
(
  'government-schemes-for-artisans-explained',
  'PM Vishwakarma and other government support for artisans, explained plainly',
  'What a few major schemes actually offer, without the official jargon.',
  'Government schemes for artisans tend to get described in language written for officials, not for the person the scheme is actually meant to help. Here is what a few of the major ones actually offer, without the jargon.

## PM Vishwakarma

Launched by the Government of India, PM Vishwakarma is aimed at traditional artisans and craftspeople working across a defined list of trades, from weaving to pottery to blacksmithing. It offers recognition through an ID card and certificate, skill training, a toolkit incentive, and access to collateral-free loans at concessional rates in stages. The exact benefits and eligibility depend on your specific trade and state, so the details are worth checking directly through the scheme''s own portal rather than relying on secondhand summaries, including this one.

## MSME registration through Udyam

If you sell your craft as a business, registering as a Micro, Small, or Medium Enterprise through the Udyam portal is usually free and takes a few minutes. It does not fund anything by itself, but it is often the prerequisite for other benefits: certain loans, government tenders, and some state-level artisan schemes require Udyam registration before you can even apply.

## GI tagging

A Geographical Indication tag legally protects a craft''s name for producers from its actual region, similar to how Champagne is protected for producers in that region of France. Kanchipuram silk and Channapatna toys are examples of Indian crafts with GI protection. It will not sell your specific product by itself, but it protects the value of the name your craft is known by, which matters more the more well-known that name becomes.

## Where to check what applies to you

Schemes and their details change, and eligibility depends on your trade, state, and circumstances. Treat any summary, including this one, as a starting point for figuring out what to look into, not the final word on what you actually qualify for.',
  'schemes'
)
on conflict (slug) do nothing;
