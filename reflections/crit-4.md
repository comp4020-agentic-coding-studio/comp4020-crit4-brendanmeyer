# Crit 4

**What was the breakthrough that moved the work forward?**

The harp worked fine on desktop, but on mobile sometimes only two or three strings would show. The key was noticing that it didn't happen when the page was loaded directly at a phone-sized viewport. It only happened when the page started at desktop size and was then resized down. That narrowed the problem from "why is the mobile layout broken?" to what was happening specifically during resize. After reproducing that sequence in the browser, I found that the resize handler was keeping the old zoom level and clamping it to the new bounds instead of recalculating it for the new viewport. So even though the zoom was technically within the allowed range, it was still much too large for the mobile width, which is why most of the strings ended up off-screen.

**What did this work change about who I want to be as a developer?**

I want to put more effort into finding bugs before a product is shipped, rather than waiting for them to come up later. This means doing more thorough testing, trying different interactions and edge cases, and actively looking for ways the product might break. When bugs are found, I want to make sure they can be reproduced consistently so it's easier to understand what is causing them and properly test the fix. The goal is to catch and resolve as many issues as possible before shipping, so the final product feels reliable and complete.