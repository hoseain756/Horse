# Horse — Complete Website Text Content

> Extracted for content review and translation. Source: `http://localhost:3000` (the Horse web app, rendered SPA), captured with a real browser at 1280×800, EN / dark / LTR. Every page below reflects the actual rendered DOM in visual order.
> Generated: 2026-10-08 · Method: DOM walk (headings → controls → text), repeated poster-card groups compressed into one-line data samples.

**Conventions:** `##`/`###` = page & section headings · `[button]`/`[link]`/`[tab]` = interactive controls · `chip:` = small pill labels · `[cards xN] under …` = **dynamic catalog data** (poster rows; titles are content, not UI strings) · `(aria: …)` = accessibility labels.

## Table of contents

1. Global chrome (persists on every page)
2. Home
3. Discover
4. Movies
5. Shows
6. Anime
7. Kids
8. Live TV
9. Calendar
10. Library
11. Addons
12. Catalogs
13. Wrapped
14. Settings — Basics · Player · Theme · Language · Integrations · Data · About
15. Sign in to Stremio (modal)
16. Search (docked dropdown + full-screen view)
17. Title details — Movie
18. Title details — Series (with Episodes)
19. Stream picker (dialog)
20. Add-to-list popover
21. Player controls (dialog)


## Global chrome (persists on every page)

*Shown on every view: navigation tabs, the search bar, and the footer.*

[nav “Primary navigation”]
- [tab] Settings
- [tab] Kids
- [tab] Anime
- [tab] Home
- input (placeholder: Search…; label: Search movies, series, people and addons)
- [button] AI  *(AI ask, inside the search bar)*
[footer] HorseHorse — an open-source media center. Not affiliated with Stremio. Addons are user-installed; Horse hosts no content.Inspired by the Harbor desktop app: github.com/harborstremio/harbor (MIT). This is a web port.TMDBThis product uses the TMDB API but is not endorsed or certified by TMDB.
- Horse — an open-source media center. Not affiliated with Stremio. Addons are user-installed; Horse hosts no content.
- Inspired by the Harbor desktop app: github.com/harborstremio/harbor (MIT). This is a web port.
- TMDBThis product uses the TMDB API but is not endorsed or certified by TMDB.


## Home

- [cards x10] under “Top 10 Todaytrending on Stremio”: Peddi | Watch What Happens Live with Andy Cohen | Spider-Man: Brand New Day | The Tonight Show Starring Jimmy Fallon | D54 | The Late Show with Stephen Colbert | Resident Evil | Reacher | The Odyssey | Running Man
- [cards x24]: Peddi | Spider-Man: Brand New Day | D54 | Resident Evil | The Odyssey | Runner | Hotel Tehran | Tom Clancy's Jack Ryan: Ghost War | Coyote vs. Acme | After Impact | Dhurandhar The Revenge | The End of Oak Street | Tvoe serdtse budet razbito | Red Latex | …
- [cards x24]: Unabomber | The Love Hypothesis | Backrooms | The Uprising | Obsession | Spider-Man: Brand New Day | The End of Oak Street | Project Hail Mary | Coyote vs. Acme | Toy Story 5 | The Whisper Man | Doing Life | Mayday | Evil Dead Burn | …
- [cards x24]: Watch What Happens Live with Andy Cohen | The Tonight Show Starring Jimmy Fallon | The Late Show with Stephen Colbert | Reacher | Running Man | Law & Order: Special Victims Unit | David | Grey's Anatomy | Law & Order | Deathstroke: Knights & Dragons | Lanterns | Late Night with Seth Meyers | The Simpsons | The Mentalist | …
- [cards x24]: Ted Lasso | Slow Horses | Last Seen | R.J. Decker | Best Medicine | Phineas and Ferb | Blue Lights | Reasonable Doubt | It's Always Sunny in Philadelphia | Last Week Tonight with John Oliver | Lanterns | Animal Control | The Simpsons | Cops | …
- [cards x24]: East of Eden | Lanterns | MobLand | Ted Lasso | American Horror Story | Slow Horses | The Gentlemen | Neagley | Coven Academy | A Different World | Reacher | Lioness | Brothers | The Mentalist | …
[section “Featured”]
- [button] View details
- [button] Go to slide 1
- [button] Go to slide 2
- [button] Go to slide 3
- [button] Go to slide 4
- [button] Go to slide 5
- [button] Go to slide 6
- [button] Go to slide 7
- [button] Go to slide 8
- Slide 2 of 8
[section “Continue Watching”]
### Continue Watching
- [button] PAUSED (aria: Resume PAUSED, 21%)
- PAUSED
[section “Optional integrations to complete your setup”]
### Complete your Harbor setup
- 3 integrations not active yet — free keys take about a minute to add.
- TMDBNot set upBetter artwork, title logos, cast & recommendations
- RatingsNot set upIMDb, Rotten Tomatoes, Metacritic & Trakt scores on every title
- TraktActiveSync scrobbles, watchlist & history with link a code
- SimklNot set upTrack what you watch across devices with a PIN code
- [button] Set up in Settings → Integrations
- [button] Dismiss setup suggestions
[section “Top 10 today”]
### Top 10 Today
[section “Trending Movies”]
### Trending Movies
[section “In Theaters”]
### In Theaters
[section “Trending Series”]
### Trending Series
[section “Popular Series”]
### Popular Series
[section “Top Rated Series”]
### Top Rated Series


## Discover

- [cards x24]: Peddi | Spider-Man: Brand New Day | D54 | Resident Evil | The Odyssey | Runner | Hotel Tehran | Tom Clancy's Jack Ryan: Ghost War | Coyote vs. Acme | After Impact | Dhurandhar The Revenge | The End of Oak Street | Tvoe serdtse budet razbito | Red Latex | …
- [cards x24]: Watch What Happens Live with Andy Cohen | The Tonight Show Starring Jimmy Fallon | The Late Show with Stephen Colbert | Reacher | Running Man | Law & Order: Special Victims Unit | David | Grey's Anatomy | Law & Order | Deathstroke: Knights & Dragons | Lanterns | Late Night with Seth Meyers | The Simpsons | The Mentalist | …
- [cards x24]: Unabomber | The Love Hypothesis | Backrooms | The Uprising | Obsession | Spider-Man: Brand New Day | The End of Oak Street | Project Hail Mary | Coyote vs. Acme | Toy Story 5 | The Whisper Man | Doing Life | Mayday | Evil Dead Burn | …
- [cards x24]: East of Eden | Lanterns | MobLand | Ted Lasso | American Horror Story | Slow Horses | The Gentlemen | Neagley | Coven Academy | A Different World | Reacher | Lioness | Brothers | The Mentalist | …
- [cards x24]: Coyote vs. Acme | Toy Story 5 | The Muppet Show | The Sheep Detectives | Star Wars: The Mandalorian and Grogu | Hocus Pocus | The Nightmare Before Christmas | Harry Potter and the Sorcerer's Stone | Casper | Toy Story | The Wizard of Oz | Toy Story 3 | Hoppers | Toy Story 2 | …
- [cards x24]: Spider-Man: Brand New Day | The End of Oak Street | Project Hail Mary | Coyote vs. Acme | Toy Story 5 | Mayday | Avengers: Endgame | X-Men | Good Luck, Have Fun, Don't Die | Star Wars: The Mandalorian and Grogu | Colony | The Nightmare Before Christmas | Interstellar | Inception | …
- [cards x24]: Lanterns | American Horror Story | Slow Horses | Neagley | Coven Academy | The Mentalist | Dexter: Resurrection | Widow's Bay | Silo | Murder in a Small Town | Re: Zero - Starting Life in Another World | Last Seen | The Final Problem | The Blame | …
- [cards x24]: The Love Hypothesis | Doing Life | The Invite | Teenage Sex and Death at Camp Miasma | Practical Magic | One Night Only | The Drama | Anora | Voicemails for Isabelle | Hamnet | Good Will Hunting | Wuthering Heights | Leviticus | Dracula | …
- [cards x24]: The Final Problem | Band of Brothers | Chernobyl | The Crown | Babylon Berlin | The Last Kingdom | The Chosen | Deadwood | Call the Midwife | Little House on the Prairie | The Scandal | The Tudors | A Tale of Two Cities | One Hundred Years of Solitude | …
- [cards x24]: The Muppet Show | Tuner | Michael | Whiplash | The Idea of You | The Pianist | Don't Say Good Luck | La La Land | Power Ballad | Amadeus | Pitch Perfect | Coco | Song Sung Blue | KPop Demon Hunters | …
- [button] Back
## Discover
[section “Spotlight”]
- chip: 2026
- chip: 8.1
## Spider-Man: Brand New Day
- [button] Play
- [button] Details
- [button] Slide 1
- [button] Slide 2
- [button] Slide 3
[section “Trending Movies”]
### Trending Movies
- chip: View all
[section “Trending Series”]
### Trending Series
- chip: View all
[section “Top Rated Movies”]
### Top Rated Movies
- chip: View all
[section “Top Rated Series”]
### Top Rated Series
- chip: View all
[section “Family Picks”]
### Family Picks
- chip: View all …(repeats)
[section “Adventures”]
### Adventures
[section “Mystery Series”]
### Mystery Series
[section “Romance”]
### Romance
[section “History & War”]
### History & War
[section “Music & Musicals”]
### Music & Musicals


## Movies

- [cards x24]: Peddi | Spider-Man: Brand New Day | D54 | Resident Evil | The Odyssey | Runner | Hotel Tehran | Tom Clancy's Jack Ryan: Ghost War | Coyote vs. Acme | After Impact | Dhurandhar The Revenge | The End of Oak Street | Tvoe serdtse budet razbito | Red Latex | …
- [cards x24]: Unabomber | The Love Hypothesis | Backrooms | The Uprising | Obsession | Spider-Man: Brand New Day | The End of Oak Street | Project Hail Mary | Coyote vs. Acme | Toy Story 5 | The Whisper Man | Doing Life | Mayday | Evil Dead Burn | …
- [cards x24]: The Uprising | Spider-Man: Brand New Day | The End of Oak Street | Mayday | Disclosure Day | Avengers: Endgame | In the Grey | The Ministry of Ungentlemanly Warfare | X-Men | Good Luck, Have Fun, Don't Die | Star Wars: The Mandalorian and Grogu | The Gentlemen | Colony | Sinners | …
- [cards x24]: The Love Hypothesis | Project Hail Mary | Coyote vs. Acme | Toy Story 5 | Mayday | The Invite | Teenage Sex and Death at Camp Miasma | The Muppet Show | Practical Magic | The Ministry of Ungentlemanly Warfare | Good Luck, Have Fun, Don't Die | The Sheep Detectives | Mean Girls | Hocus Pocus | …
- [cards x24]: Backrooms | Project Hail Mary | Disclosure Day | Avengers: Endgame | Interstellar | Inception | Resident Evil | The Prestige | Superman | 28 Years Later: The Bone Temple | Avengers: Infinity War | Bugonia | The Hunger Games | Donnie Darko | …
- [cards x24]: Backrooms | Obsession | Evil Dead Burn | Teenage Sex and Death at Camp Miasma | Weapons | Colony | Sinners | Hokum | Resident Evil | Barbarian | The Silence of the Lambs | Hereditary | Insidious: Out of the Further | Frankenstein | …
- [cards x24]: Unabomber | The Uprising | The Whisper Man | Doing Life | The Invite | Teenage Sex and Death at Camp Miasma | The Shawshank Redemption | Pressure | Tuner | East of Eden | Oppenheimer | The Housemaid | Mean Girls | The Rivals of Amziah King | …
- [cards x24]: Coyote vs. Acme | Toy Story 5 | The Nightmare Before Christmas | Toy Story | Avatar Aang: The Last Airbender | Toy Story 3 | Hoppers | Toy Story 2 | Coraline | Spider-Man: Into the Spider-Verse | Minions & Monsters | Toy Story 4 | Spirited Away | The Super Mario Galaxy Movie | …
- [cards x24]: The Last First: Winter K2 | The Widower: 'Til Death Do Us Part | Schumacher '94: The Birth of a Legend | The AI Doc: Or How I Became an Apocaloptimist | Titanic: The Digital Resurrection | Predators | Jackass: Best and Last | Some Kind of Heaven | Dear Zachary: A Letter to a Son About His Father | Spermworld | Tell Me Who I Am | Girl in the Picture | The Perfect Neighbor | Aileen: Queen of the Serial Killers | …
- [button] Back
## Movies
[section “Spotlight”]
- chip: 2026
- chip: 8.1
## Spider-Man: Brand New Day
- [button] Play
- [button] Details
- [button] Slide 1
- [button] Slide 2
- [button] Slide 3
- [button] Slide 4
- [button] Slide 5
[section “Popular Movies”]
### Popular Movies
- chip: View all
[section “Top Rated”]
### Top Rated
- chip: View all
[section “Action”]
### Action
- chip: View all
[section “Comedy”]
### Comedy
- chip: View all
[section “Sci-Fi & Fantasy”]
### Sci-Fi & Fantasy
- chip: View all …(repeats)
[section “Horror”]
### Horror
[section “Drama”]
### Drama
[section “Animation”]
### Animation
[section “Documentary”]
### Documentary


## Shows

- [cards x24]: Watch What Happens Live with Andy Cohen | The Tonight Show Starring Jimmy Fallon | The Late Show with Stephen Colbert | Reacher | Running Man | Law & Order: Special Victims Unit | David | Grey's Anatomy | Law & Order | Deathstroke: Knights & Dragons | Lanterns | Late Night with Seth Meyers | The Simpsons | The Mentalist | …
- [cards x24]: East of Eden | Lanterns | MobLand | Ted Lasso | American Horror Story | Slow Horses | The Gentlemen | Neagley | Coven Academy | A Different World | Reacher | Lioness | Brothers | The Mentalist | …
- [cards x24]: East of Eden | Lanterns | MobLand | Ted Lasso | American Horror Story | Slow Horses | The Gentlemen | Neagley | Coven Academy | A Different World | Reacher | Lioness | The Mentalist | Dexter: Resurrection | …
- [cards x24]: Ted Lasso | The Gentlemen | Coven Academy | A Different World | Brothers | Kill Jackie | Widow's Bay | The Rookie | Best Medicine | Youth | South Park | One Piece | Scrubs | The Office | …
- [cards x24]: Lanterns | MobLand | Slow Horses | The Gentlemen | Neagley | Reacher | The Mentalist | Dexter: Resurrection | Kill Jackie | Breaking Bad | Murder in a Small Town | Last Seen | The Rookie | The Sopranos | …
- [cards x24]: American Horror Story | Dark Matter | Star Trek: Strange New Worlds | Severance | Pluribus | Stuart Fails to Save the Universe | The Handmaid's Tale | For All Mankind | Doctor Who | Foundation | The Expanse | Westworld | Fringe | President Curtis | …
- [cards x24]: The Celebrity Traitors UK | The Traitors | The Great British Baking Show | Special Forces: World's Toughest Test | Clarkson's Farm | The Grand Tour | Survivor | Top Gear | Below Deck Mediterranean | Below Deck | The Traitors UK | Game Changer | Ghost Adventures | …
- [cards x24]: The Rehearsal | The Bombing of Pan Am 103 | To Catch a Predator | Nathan for You | Clarkson's Farm | Planet Earth II | Unabomber: In His Own Words | Knife Edge: Chasing Michelin Stars | Death of the Pastor's Wife | Ren Faire | How to with John Wilson | Planet Earth | The Last Dance | Cosmos: A Spacetime Odyssey | …
- [button] Back
## Shows
[section “Spotlight”]
- chip: 2014
- chip: 7.0
## The Tonight Show Starring Jimmy Fallon
- [button] Play
- [button] Details
- [button] Slide 1
- [button] Slide 2
- [button] Slide 3
- [button] Slide 4
- [button] Slide 5
[section “Trending Series”]
### Trending Series
- chip: View all
[section “Top Rated Series”]
### Top Rated Series
- chip: View all
[section “Drama Series”]
### Drama Series
- chip: View all
[section “Comedy Series”]
### Comedy Series
- chip: View all
[section “Crime & Mystery”]
### Crime & Mystery
- chip: View all …(repeats)
[section “Sci-Fi & Fantasy”]
### Sci-Fi & Fantasy
[section “Reality”]
### Reality
[section “Documentary”]
### Documentary


## Anime

- [cards x5] under “8.71999TVONE PIECEFind streamsAniList page”: Trending NowAniListONE PIECE · ActionAniListReincarnated as a Sword Season 2 · 12 eps · ActionAniListThe Laid-Off Cheat-Granting Mage Enjoys a Second Lease on Life · AdventureAniListBlack Clover · 170 eps · ActionAniListA Returner's Magic Should be Special Season 2 · ActionAniListRe:ZERO -Starting Life in Another World- Season 4 · 19 eps · ActionAniListThe World's Strongest Witch · ActionAniListMushoku Tensei: Jobless Reincarnation Season 3 · 14 eps · AdventureAniListBleach · 366 eps · ActionAniListA Returner's Magic Should Be Special · 12 eps · ActionAniListThat Time I Got Reincarnated as a Slime Season 4 · 24 eps · ActionAniListBlack Clover Season 2 · ActionAniListNia Liston: The Merciless Maiden · 25 eps · ActionAniListSmoking Behind the Supermarket with You · 12 eps · ComedyAniListSo What's Wrong with Getting Reborn as a Goblin? · ActionAniListMagic Knight Rayearth () · AdventureAniListOvergeared · 12 eps · ActionAniListDaemons of the Shadow Realm · 24 eps · ActionAniListYou and I Are Polar Opposites Season 2 · 13 eps · ComedyAniListHunter x Hunter () · 148 eps · ActionAniListNaruto: Shippuden · 500 eps · ActionAniListTrapped in a Dating Sim: The World of Otome Games is Tough for Mobs Season 2 · 12 eps · ActionAniListSasaki and Peeps Season 2 · 12 eps · ComedyAniListThe Apothecary Diaries Season 2 · 24 eps · Drama | Popular This SeasonAniListThe Apothecary Diaries Season 3 · 12 eps · DramaAniListBlack Clover Season 2 · ActionAniListCyberpunk: Edgerunners 2 · 10 eps · ActionAniListReincarnated as a Sword Season 2 · 12 eps · ActionAniListBlue Box Season 2 · 12 eps · RomanceAniListMade in Abyss: Mezameru Shinpi · Movie · AdventureAniListWitch on the Holy Night · Movie · ActionAniListSTEEL BALL RUN JoJo's Bizarre Adventure 2nd - 3rd STAGE · 11 eps · ActionAniListRascal Does Not Dream of a Dear Friend · Movie · DramaAniListTokyo Revengers: War of the Three Titans Arc · 13 eps · ActionAniListOvergeared · 12 eps · ActionAniListThe Ramparts of Ice Season 2 · ComedyAniListEven the Student Council Has Its Holes! · 12 eps · ComedyAniListKusuriya no Hitorigoto: Bouhi no Hihou · Movie · DramaAniListA Returner's Magic Should be Special Season 2 · ActionAniListFirefly Wedding · DramaAniListAs a Reincarnated Aristocrat, I'll Use My Appraisal Skill to Rise in the World Season 3 · AdventureAniListThe Detective Is Already Dead Season 2 · 13 eps · ComedyAniListFool Night · DramaAniListAoashi Season 2 · 24 eps · SportsAniListA Wild Last Boss Appeared! Season 2 · ActionAniListThe Laid-Off Cheat-Granting Mage Enjoys a Second Lease on Life · AdventureAniListI'm Dating a Dark Summoner · 12 eps · ComedyAniListHello, I am a Witch and my Crush Wants me to Make a Love Potion! · 12 eps · Fantasy | All-Time BestAniListFrieren: Beyond Journey’s End · 28 eps · AdventureAniListGintama: THE VERY FINAL · Movie · ActionAniListGintama Season 3 · 51 eps · ActionAniListRe:ZERO -Starting Life in Another World- Season 4 · 19 eps · ActionAniListChainsaw Man – The Movie: Reze Arc · Movie · ActionAniListFullmetal Alchemist: Brotherhood · 64 eps · ActionAniListAttack on Titan Season 3 Part 2 · 10 eps · ActionAniListBLEACH: Thousand-Year Blood War - The Calamity · 10 eps · ActionAniListONE PIECE FAN LETTER · 1 eps · ActionAniListSteins;Gate · 24 eps · DramaAniListOwarimonogatari Second Season · 7 eps · ComedyAniListFruits Basket The Final Season · 13 eps · ComedyAniListHunter x Hunter () · 148 eps · ActionAniListGintama Season 2 Part 2 · 13 eps · ActionAniListGintama Season 2 · 51 eps · ActionAniListMarch comes in like a lion Season 2 · 22 eps · DramaAniListTomorrow's Joe 2 · 47 eps · ActionAniListGintama Season 4 · 12 eps · ActionAniListKaguya-sama: Love is War -Ultra Romantic- · 13 eps · ComedyAniListBLEACH: Thousand-Year Blood War · 13 eps · ActionAniListThe Apothecary Diaries Season 2 · 24 eps · DramaAniListLegend of the Galactic Heroes · 110 eps · DramaAniListVinland Saga Season 2 · 24 eps · ActionAniListMonster · 74 eps · Drama | Anime MoviesAniListA Silent Voice · Movie · DramaAniListYour Name. · Movie · DramaAniListDemon Slayer -Kimetsu no Yaiba- The Movie: Mugen Train · Movie · ActionAniListSpirited Away · Movie · AdventureAniListJUJUTSU KAISEN 0 · Movie · ActionAniListI Want to Eat Your Pancreas · Movie · DramaAniListHowl‘s Moving Castle · Movie · AdventureAniListWeathering With You · Movie · DramaAniListPrincess Mononoke · Movie · ActionAniListMy Neighbor Totoro · Movie · AdventureAniListRascal Does Not Dream of a Dreaming Girl · Movie · DramaAniListNeon Genesis Evangelion: The End of Evangelion · Movie · ActionAniList5 Centimeters per Second · Movie · DramaAniListThe Garden of Words · Movie · DramaAniListPerfect Blue · Movie · DramaAniListKONOSUBA -God's blessing on this wonderful world!- Legend of Crimson · Movie · ActionAniListChainsaw Man – The Movie: Reze Arc · Movie · ActionAniListAkira · Movie · ActionAniListNo Game, No Life Zero · Movie · ActionAniListMy Hero Academia: Two Heroes · Movie · ActionAniListGrave of the Fireflies · Movie · DramaAniListSuzume · Movie · AdventureAniListViolet Evergarden: the Movie · Movie · DramaAniListDemon Slayer: Kimetsu no Yaiba Infinity Castle · Movie · Action | Upcoming Next SeasonAniListMASHLE: Sanma Taisou Shinkakusha Saishuu Shiken-hen · ActionAniListShangri-La Frontier Season 3 · ActionAniListSekai Saikou no Ansatsusha, Isekai Kizoku ni Tensei suru 2nd Season · ActionAniListTHE ONE PIECE · 7 eps · AdventureAniListSAKAMOTO DAYS Season 2 · ActionAniListThe Guy She Was Interested In Wasn't a Guy At All · MusicAniListSekiro: No Defeat · 8 eps · ActionAniListMARRIAGETOXIN 2nd Season · ActionAniListKakunaru Ue wa · ComedyAniListJirai nan desu ka? Chihara-san · ComedyAniListKuroiwa Medaka ni Watashi no Kawaii ga Tsuujinai 2nd Season · ComedyAniListFutsutsuka na Akujo de wa Gozaimasu ga: Suuguu Chouso Torikae Den Part 2 · DramaAniListAkane-banashi 2nd Season · DramaAniListghost – end of night · Movie · SupernaturalAniListHirayasumi · ComedyAniListHimekishi-sama no Himo · ActionAniListMedalist Movie · Movie · DramaAniListSSS-Class Revival Hunter · ActionAniListHistorié · AdventureAniListBless · Slice of LifeAniListGolden Kamuy: Saishuushou - Bousou Ressha-hen · ActionAniListMairimashita! Iruma-kun: If Episode of Mafia · ActionAniListBanG Dream! It's MyGO!!!!! / Ave Mujica (Zoku-hen) · MusicAniListIsshiki-san wa Koi wo Shiritai. · Action
- [cards x24]: AniListONE PIECE · Action | AniListReincarnated as a Sword Season 2 · 12 eps · Action | AniListThe Laid-Off Cheat-Granting Mage Enjoys a Second Lease on Life · Adventure | AniListBlack Clover · 170 eps · Action | AniListA Returner's Magic Should be Special Season 2 · Action | AniListRe:ZERO -Starting Life in Another World- Season 4 · 19 eps · Action | AniListThe World's Strongest Witch · Action | AniListMushoku Tensei: Jobless Reincarnation Season 3 · 14 eps · Adventure | AniListBleach · 366 eps · Action | AniListA Returner's Magic Should Be Special · 12 eps · Action | AniListThat Time I Got Reincarnated as a Slime Season 4 · 24 eps · Action | AniListBlack Clover Season 2 · Action | AniListNia Liston: The Merciless Maiden · 25 eps · Action | AniListSmoking Behind the Supermarket with You · 12 eps · Comedy | …
- [cards x24]: AniListThe Apothecary Diaries Season 3 · 12 eps · Drama | AniListBlack Clover Season 2 · Action | AniListCyberpunk: Edgerunners 2 · 10 eps · Action | AniListReincarnated as a Sword Season 2 · 12 eps · Action | AniListBlue Box Season 2 · 12 eps · Romance | AniListMade in Abyss: Mezameru Shinpi · Movie · Adventure | AniListWitch on the Holy Night · Movie · Action | AniListSTEEL BALL RUN JoJo's Bizarre Adventure 2nd - 3rd STAGE · 11 eps · Action | AniListRascal Does Not Dream of a Dear Friend · Movie · Drama | AniListTokyo Revengers: War of the Three Titans Arc · 13 eps · Action | AniListOvergeared · 12 eps · Action | AniListThe Ramparts of Ice Season 2 · Comedy | AniListEven the Student Council Has Its Holes! · 12 eps · Comedy | AniListKusuriya no Hitorigoto: Bouhi no Hihou · Movie · Drama | …
- [cards x24]: AniListFrieren: Beyond Journey’s End · 28 eps · Adventure | AniListGintama: THE VERY FINAL · Movie · Action | AniListGintama Season 3 · 51 eps · Action | AniListRe:ZERO -Starting Life in Another World- Season 4 · 19 eps · Action | AniListChainsaw Man – The Movie: Reze Arc · Movie · Action | AniListFullmetal Alchemist: Brotherhood · 64 eps · Action | AniListAttack on Titan Season 3 Part 2 · 10 eps · Action | AniListBLEACH: Thousand-Year Blood War - The Calamity · 10 eps · Action | AniListONE PIECE FAN LETTER · 1 eps · Action | AniListSteins;Gate · 24 eps · Drama | AniListOwarimonogatari Second Season · 7 eps · Comedy | AniListFruits Basket The Final Season · 13 eps · Comedy | AniListHunter x Hunter () · 148 eps · Action | AniListGintama Season 2 Part 2 · 13 eps · Action | …
- [cards x24]: AniListA Silent Voice · Movie · Drama | AniListYour Name. · Movie · Drama | AniListDemon Slayer -Kimetsu no Yaiba- The Movie: Mugen Train · Movie · Action | AniListSpirited Away · Movie · Adventure | AniListJUJUTSU KAISEN 0 · Movie · Action | AniListI Want to Eat Your Pancreas · Movie · Drama | AniListHowl‘s Moving Castle · Movie · Adventure | AniListWeathering With You · Movie · Drama | AniListPrincess Mononoke · Movie · Action | AniListMy Neighbor Totoro · Movie · Adventure | AniListRascal Does Not Dream of a Dreaming Girl · Movie · Drama | AniListNeon Genesis Evangelion: The End of Evangelion · Movie · Action | AniList5 Centimeters per Second · Movie · Drama | AniListThe Garden of Words · Movie · Drama | …
- [cards x24]: AniListMASHLE: Sanma Taisou Shinkakusha Saishuu Shiken-hen · Action | AniListShangri-La Frontier Season 3 · Action | AniListSekai Saikou no Ansatsusha, Isekai Kizoku ni Tensei suru 2nd Season · Action | AniListTHE ONE PIECE · 7 eps · Adventure | AniListSAKAMOTO DAYS Season 2 · Action | AniListThe Guy She Was Interested In Wasn't a Guy At All · Music | AniListSekiro: No Defeat · 8 eps · Action | AniListMARRIAGETOXIN 2nd Season · Action | AniListKakunaru Ue wa · Comedy | AniListJirai nan desu ka? Chihara-san · Comedy | AniListKuroiwa Medaka ni Watashi no Kawaii ga Tsuujinai 2nd Season · Comedy | AniListFutsutsuka na Akujo de wa Gozaimasu ga: Suuguu Chouso Torikae Den Part 2 · Drama | AniListAkane-banashi 2nd Season · Drama | AniListghost – end of night · Movie · Supernatural | …
- [cards x24]: Watch What Happens Live with Andy Cohen | The Tonight Show Starring Jimmy Fallon | The Late Show with Stephen Colbert | Reacher | Running Man | Law & Order: Special Victims Unit | David | Grey's Anatomy | Law & Order | Deathstroke: Knights & Dragons | Lanterns | Late Night with Seth Meyers | The Simpsons | The Mentalist | …
## Anime
- Catalog by AniList · click any title to resolve into your Stremio catalogs
[section “Trending anime spotlight”]
- chip: 8.7
- chip: TV
### ONE PIECE
- [button] Find streams
- [link] AniList page
- [button] Spotlight 1
- [button] Spotlight 2
- [button] Spotlight 3
- [button] Spotlight 4
- [button] Spotlight 5
### Stremio catalogs
- Anime catalogs from Cinemeta and your installed addons
[section “From Stremio Catalogs”]
### From Stremio Catalogs
- chip: View all


## Kids

- [cards x6] under “Kids Corner Fun and safe picks for the little ones.Card size”: Animated MoviesView allCoyote vs. AcmeToy Story 5The Nightmare Before ChristmasToy StoryToy Story 3HoppersToy Story 2CoralineMinions & MonstersToy Story 4Spirited AwayThe Super Mario Galaxy MovieCarsMonster HouseCorpse BrideZootopia 2The Wild RobotThe Lion KingYour Name.Ratatouille | Family MoviesView allCoyote vs. AcmeToy Story 5The Muppet ShowThe Sheep DetectivesHocus PocusThe Nightmare Before ChristmasHarry Potter and the Sorcerer's StoneCasperToy StoryThe Wizard of OzToy Story 3HoppersToy Story 2CoralineThe Princess BrideHarry Potter and the Goblet of FireMinions & MonstersToy Story 4Spirited AwayThe Goonies | Kids TVView allRe: Zero - Starting Life in Another WorldSouth ParkRick and MortyThe SimpsonsFuturamaFamily GuyPresident CurtisBoJack HorsemanOver the Garden WallBob's BurgersFrieren: Beyond Journey's EndSpongeBob SquarePantsGravity FallsAmerican Dad!King of the Hill | Family ShowsView allCoven AcademyThe MiddleOver the Garden WallMalcolm in the MiddleHeartlandSpongeBob SquarePantsGravity FallsKing of the HillBlueyAnne with an EDr. Quinn, Medicine WomanLost in SpaceBoy Meets WorldPlanet EarthGilligan's IslandBewitchedDoctor WhoVictorious3rd Rock from the Sun | Sing-AlongView allThe Muppet ShowCocoSingSoulSing 2 | AdventuresView allCoyote vs. AcmeToy Story 5The Nightmare Before ChristmasHarry Potter and the Sorcerer's StoneToy StoryThe Wizard of OzToy Story 3HoppersToy Story 2
- [cards x20]: Coyote vs. Acme | Toy Story 5 | The Nightmare Before Christmas | Toy Story | Toy Story 3 | Hoppers | Toy Story 2 | Coraline | Minions & Monsters | Toy Story 4 | Spirited Away | The Super Mario Galaxy Movie | Cars | Monster House | …
- [cards x20]: Coyote vs. Acme | Toy Story 5 | The Muppet Show | The Sheep Detectives | Hocus Pocus | The Nightmare Before Christmas | Harry Potter and the Sorcerer's Stone | Casper | Toy Story | The Wizard of Oz | Toy Story 3 | Hoppers | Toy Story 2 | Coraline | …
- [cards x15]: Re: Zero - Starting Life in Another World | South Park | Rick and Morty | The Simpsons | Futurama | Family Guy | President Curtis | BoJack Horseman | Over the Garden Wall | Bob's Burgers | Frieren: Beyond Journey's End | SpongeBob SquarePants | Gravity Falls | American Dad! | …
- [cards x19]: Coven Academy | The Middle | Over the Garden Wall | Malcolm in the Middle | Heartland | SpongeBob SquarePants | Gravity Falls | King of the Hill | Bluey | Anne with an E | Dr. Quinn, Medicine Woman | Lost in Space | Boy Meets World | Planet Earth | …
- [cards x9]: Coyote vs. Acme | Toy Story 5 | The Nightmare Before Christmas | Harry Potter and the Sorcerer's Stone | Toy Story | The Wizard of Oz | Toy Story 3 | Hoppers | Toy Story 2
## Kids Corner
- Fun and safe picks for the little ones.
- [button] Large
- [button] Medium
- [button] Small


## Live TV

- [button] Back
## Live TV
- [button] Add playlist
- input (placeholder: Filter channels…; label: Filter channels)
- No playlists yet. Add an M3U playlist to watch live TV.
- Harbor is a neutral client — bring your own playlists.


## Calendar

- [cards x48] under “Anime airing this weekAniList”: EP 161Renegade ImmortalMon 02:00 | EP 1Yuusanchi! from YuuhachiMon 02:00 | EP 1Hello, I am a Witch and my Crush Wants me to Make a Love Potion!Mon 12:30 | EP 1So What's Wrong with Getting Reborn as a Goblin?Mon 13:00 | EP 1PSYRENMon 14:00 | EP 1MAGICAL GIRL RAISING PROJECT restartMon 17:00 | EP 422Wushen Zhuzai: Da Wei PianTue 02:00 | EP 18Jueshi Zhan Hun 2Tue 02:00 | EP 1Nia Liston: The Merciless MaidenTue 12:26 | EP 1The Cold Sato-san is Only Sweet to MeTue 13:00 | EP 1Super Psychic Policeman ChojoTue 14:00 | EP 1Battle Spirits [Re] Zekkai No KuTue 14:00 | EP 1The Laid-Off Cheat-Granting Mage Enjoys a Second Lease on LifeTue 15:00 | EP 14Red RiverTue 16:35 | …
- [cards x14] under “New episodes this week”: Watch What Happens Live with Andy Cohen | The Tonight Show Starring Jimmy Fallon | The Late Show with Stephen Colbert | Reacher | Running Man | Law & Order: Special Victims Unit | David | Grey's Anatomy | Law & Order | Deathstroke: Knights & Dragons | Lanterns | Late Night with Seth Meyers | The Simpsons | The Mentalist
- [button] Back
## Calendar
- Weekly airing schedule for series you track — from your watchlist, continue watching and history.
- chip: Prev
- chip: Today
- chip: Next
### No tracked series yet
- Add shows to your watchlist or start watching, and their weekly episode air dates will appear here automatically.
- [button] Browse shows
[section “Anime airing this week”]
### Anime airing this week
- chip: AniList
[section “Series with new episodes this week”]
### New episodes this week


## Library

- [button] Back
## Library
- [button] Watchlist (0)
- [button] Lists (0)
- [button] History (34)
- Your watchlist is empty. Add titles from any detail page.


## Addons

- [button] Back
## Addons
- Harbor is a neutral client for the open Stremio addon protocol. Install catalogs, streams and subtitles addons by manifest URL. Harbor hosts no content — you bring your own addons.
- input (placeholder: https://my-addon.example.com/manifest.json; label: Addon manifest URL)
- [button] Install
### Installed (0)
- No addons installed yet.
### Community addons
- Cinemeta
- Official Stremio catalog & metadata for movies and series.
- [button] Install
- OpenSubtitles v3
- Subtitles from the OpenSubtitles community addon.
- [button] Install
- Stremio Community Addons catalog
- Meta-catalog of community addons.
- [button] Install


## Catalogs

- [button] Back
## Catalogs
- Every catalog exposed by your installed addons, in one place.
- No catalogs yet.
- [button] Install addons


## Wrapped

- [button] Back
## Wrapped
- [button] Share stats
- Everything you've watched on this device, computed locally.
- 33m
- Total watch time
- 34
- Movies
- 0
- Episodes
- 1
- Active days
### Last 14 days
### Last 365 days
- Over the last 365 days you watched 33m across 1 active days.
### Achievements
- First Steps
- Watch your first title
- 1+ titles watched
- Binger
- 3+ episodes of one series in a day
- 0/3 episodes in a day
- Night Owl
- Watch between midnight and 5am
- no late-night sessions yet
- Explorer
- Discover 10 different titles
- 1/10 titles
- Devoted
- Watch one title in 5+ separate sessions
- top: 34 sessions
- Marathoner
- 8h+ of watch time in a single day
- best day: 33m of 8h
### Most watched
- DirectMP4
- 34 sessions · 33m
### Top genres
- Genres unavailable — could not reach Cinemeta for these titles.
- Stats are computed locally from your watch history. Private by design — nothing leaves this device unless you sign in to Stremio.


## Settings — Basics

### Quick Access
- Everything that used to live in the sidebar
- [button] Edit
- [button] DiscoverTrending and top picks across movies & series (aria: Discover — Trending and top picks across movies & series)
- [button] LibraryWatchlist, continue watching and your collection (aria: Library — Watchlist, continue watching and your collection)
- [button] MoviesPopular, top rated and every movie genre (aria: Movies — Popular, top rated and every movie genre)
- [button] ShowsPopular series, top rated shows and genres (aria: Shows — Popular series, top rated shows and genres)
- [button] Live TVLIVEIPTV playlists and live channels (aria: Live TV — IPTV playlists and live channels)
- [button] CalendarAiring schedule for your series (aria: Calendar — Airing schedule for your series)
- [button] AddonsInstall and manage catalog & stream addons (aria: Addons — Install and manage catalog & stream addons)
- [button] CatalogsBrowse every catalog your addons provide (aria: Catalogs — Browse every catalog your addons provide)
- [button] WrappedYour viewing stats and yearly highlights (aria: Wrapped — Your viewing stats and yearly highlights)
- Instant play
- Open the best stream immediately when clicking Play
- Auto-play next episode
- Continue to the next episode automatically
- Resume playback
- Pick up where you left off
- Confirm leaving playback
- Ask before closing the player
- Show card badges
- IMDb rating badges on posters
- Home mode
- Harbor layout with hero, or classic rows only
- [button] harbor
- [button] classic
- Show all addon rows on home
- Include every addon catalog row
- Hide watched in catalogs
- Filter titles you already watched
- Auto-hide navigation bar
- Hide the glass dock scrolling down, reveal scrolling up
- Poster size
- 100%
- Poster corner radius
- 12px


## Settings — Player

- [button] Edit
- [button] DiscoverTrending and top picks across movies & series (aria: Discover — Trending and top picks across movies & series)
- [button] LibraryWatchlist, continue watching and your collection (aria: Library — Watchlist, continue watching and your collection)
- [button] MoviesPopular, top rated and every movie genre (aria: Movies — Popular, top rated and every movie genre)
- [button] ShowsPopular series, top rated shows and genres (aria: Shows — Popular series, top rated shows and genres)
- [button] Live TVLIVEIPTV playlists and live channels (aria: Live TV — IPTV playlists and live channels)
- [button] CalendarAiring schedule for your series (aria: Calendar — Airing schedule for your series)
- [button] AddonsInstall and manage catalog & stream addons (aria: Addons — Install and manage catalog & stream addons)
- [button] CatalogsBrowse every catalog your addons provide (aria: Catalogs — Browse every catalog your addons provide)
- [button] WrappedYour viewing stats and yearly highlights (aria: Wrapped — Your viewing stats and yearly highlights)
- Use secure proxy when needed
- Routes blocked streams through this server (fixes CORS and source headers)
- [button] Auto
- [button] Always
- [button] Never
- Convert incompatible streams
- MKV/HEVC/AC3-DTS → H.264/AAC on the server (uses CPU)
- [button] Auto
- [button] Ask
- [button] Never
- Show only streams that play in the browser
- The stream picker hides unplayable sources by default
- Prefer H.264/AAC
- Rank browser-safe codecs above HEVC when sorting streams
- Seek step
- Arrow keys seek ±10s
- Subtitles size
- 28px
- Subtitle background
- 35% opacity behind text
- Subtitle border
- 0px outline
- Video fill
- How video fits the screen
- [button] fit
- [button] fill
- [button] zoom
- Player chrome
- Stremio-style or Harbor-style controls
- [button] auto
- [button] default
- [button] stremio
- Stream picker layout
- Condensed rows or Stremio-style tiers
- [button] stremio
- [button] condensed
- Quality info in picker
- Show codec, size and source details


## Settings — Theme

- [button] Edit
- [button] DiscoverTrending and top picks across movies & series (aria: Discover — Trending and top picks across movies & series)
- [button] LibraryWatchlist, continue watching and your collection (aria: Library — Watchlist, continue watching and your collection)
- [button] MoviesPopular, top rated and every movie genre (aria: Movies — Popular, top rated and every movie genre)
- [button] ShowsPopular series, top rated shows and genres (aria: Shows — Popular series, top rated shows and genres)
- [button] Live TVLIVEIPTV playlists and live channels (aria: Live TV — IPTV playlists and live channels)
- [button] CalendarAiring schedule for your series (aria: Calendar — Airing schedule for your series)
- [button] AddonsInstall and manage catalog & stream addons (aria: Addons — Install and manage catalog & stream addons)
- [button] CatalogsBrowse every catalog your addons provide (aria: Catalogs — Browse every catalog your addons provide)
- [button] WrappedYour viewing stats and yearly highlights (aria: Wrapped — Your viewing stats and yearly highlights)
- Appearance
- Light or dark Material 3 scheme of your current palette
- [button] Dark
- [button] Light
- Contrast
- Scheme contrast level — higher for stronger legibility
- [button] Standard
- [button] Medium
- [button] High
### Theme Studio
- Build a fully custom palette, fonts and layout — with live preview. Your accent color seeds the Material 3 palette.
- [button] Open Theme Studio
### Theme presets
- Your accent color seeds the Material 3 palette.
- Horse
- sidebar layout
- Nord
- nord layout
- Stremio
- stremio layout
- Crunchy
- topdock layout
- Royal
- royal layout
- Dracula
- dracula layout
- Forest
- forest layout
- Noir
- topdock layout
- Aurora
- topdock layout
- Velvet
- rail layout
- MinUI
- rail layout
### Font pairing
- [button] Sentient / Switzer
- [button] Fraunces / Inter
- [button] General Sans
- [button] Cabinet / Switzer
- [button] IBM Plex
- [button] Plus Jakarta
- [button] System
### Custom background
- [button] Upload image


## Settings — Language

- [button] Edit
- [button] DiscoverTrending and top picks across movies & series (aria: Discover — Trending and top picks across movies & series)
- [button] LibraryWatchlist, continue watching and your collection (aria: Library — Watchlist, continue watching and your collection)
- [button] MoviesPopular, top rated and every movie genre (aria: Movies — Popular, top rated and every movie genre)
- [button] ShowsPopular series, top rated shows and genres (aria: Shows — Popular series, top rated shows and genres)
- [button] Live TVLIVEIPTV playlists and live channels (aria: Live TV — IPTV playlists and live channels)
- [button] CalendarAiring schedule for your series (aria: Calendar — Airing schedule for your series)
- [button] AddonsInstall and manage catalog & stream addons (aria: Addons — Install and manage catalog & stream addons)
- [button] CatalogsBrowse every catalog your addons provide (aria: Catalogs — Browse every catalog your addons provide)
- [button] WrappedYour viewing stats and yearly highlights (aria: Wrapped — Your viewing stats and yearly highlights)
- Preferred subtitle languages
- Toggle languages below, then order them — the player picks the highest-priority match first.
- [button] English
- [button] Spanish
- [button] French
- [button] German
- [button] Japanese
- [button] Korean
- [button] Chinese
- [button] Arabic
- [button] Hindi
- [button] Portuguese
- [button] Russian
- [button] Italian
- Priority order
- [button] Move English up
- [button] Move English down
- [button] Remove English
- Subtitles off by default
- Don't auto-enable subtitle tracks


## Settings — Integrations

- [button] Edit
- [button] DiscoverTrending and top picks across movies & series (aria: Discover — Trending and top picks across movies & series)
- [button] LibraryWatchlist, continue watching and your collection (aria: Library — Watchlist, continue watching and your collection)
- [button] MoviesPopular, top rated and every movie genre (aria: Movies — Popular, top rated and every movie genre)
- [button] ShowsPopular series, top rated shows and genres (aria: Shows — Popular series, top rated shows and genres)
- [button] Live TVLIVEIPTV playlists and live channels (aria: Live TV — IPTV playlists and live channels)
- [button] CalendarAiring schedule for your series (aria: Calendar — Airing schedule for your series)
- [button] AddonsInstall and manage catalog & stream addons (aria: Addons — Install and manage catalog & stream addons)
- [button] CatalogsBrowse every catalog your addons provide (aria: Catalogs — Browse every catalog your addons provide)
- [button] WrappedYour viewing stats and yearly highlights (aria: Wrapped — Your viewing stats and yearly highlights)
### Integrations
- Connect optional third-party services. Activation-code linking keeps tokens encrypted on this app's server; the browser never sees them.
#### Trakt.tv
- Import your Trakt watchlist
- [button] Link Trakt.tv with a code
- No account setup needed — you'll get a short code to enter on trakt.tv/activate.
- Advanced: use your own Trakt app credentials
- Client ID
- input (placeholder: Your Trakt app client id)
- Client secret (optional — PKCE apps have none)
- input (placeholder: Your Trakt app client secret)
- [link] trakt.tv/oauth/applications/new
- [button] Connect
#### Simkl
- Import your Simkl watchlist
- [button] Link Simkl with a code
- No account setup needed — you'll get a short code to enter on simkl.com/pin.
- Advanced: use your own Simkl app credentials
- Client ID
- input (placeholder: Your Simkl app client id)
- Client secret (optional)
- input (placeholder: Only if your Simkl app has one)
- [link] simkl.com/apps/new
- [button] Connect
#### TMDB metadata
- Posters, backdrops, logos, cast, certifications and better search — layered on top of your addons.
- [switch] Enable TMDB metadata
- Metadata language
- Titles, overviews and images returned by TMDB.
- select (“TMDB metadata language”): English | العربية (Arabic) | Español | Français | Deutsch | Português (BR) | Italiano | Türkçe | Русский | 日本語 | 한국어 | 简体中文
- Image quality
- Higher looks sharper but downloads more bytes.
- [button] low
- [button] medium
- [button] high
- Your own TMDB API key (optional)
- input (placeholder: v3 key (32 hex chars) or v4 Read Access Token)
- Get a free key in ~1 minute:
- [link] themoviedb.org
- [link] Settings → API
- Paste it above. It is validated live, stays in this browser only, and TMDB features switch on immediately.
- This product uses the TMDB API but is not endorsed or certified by TMDB.
#### Ratings
- Scores shown on detail pages. Providers without a configured key are hidden automatically; anime titles also pull AniList / MAL / Kitsu.
- Enabled
- input (label: Show ratings on detail pages)
- [button] Default
- [button] Default
- [button] Default
- [button] Default
- [button] Default …(repeats)
- “Ordered” providers appear first in the given sequence; everything else follows in default order. Hidden automatically when a provider has no data or no key.
#### Debrid
- Unlock cached torrent streams instantly
- [tab] Real-Debrid
- [tab] AllDebrid
- Real-Debrid API key
- input (placeholder: Your Real-Debrid API key)
- [link] real-debrid.com/account
- [button] Validate
- Your key is stored in this browser only and relayed server-side per request. Torrent streams cached by the service unlock instantly; uncached torrents are skipped (honest error).
- Streams unlocked with Debrid — resolved links live only for the current session; nothing is counted or stored.
#### P2P Torrent Engine
- Play torrents without any account — server-side BitTorrent
- Play torrents via P2P
- Join swarms directly when a stream addon only offers torrents. Debrid stays the faster path for cached releases.
- [switch] Toggle P2P torrent playback
- Torrents download to a server-side cache and stream over HTTP (native containers) or through an ffmpeg remux (mkv). Idle swarms are evicted after 45 minutes; swarms that never find peers are dropped after 90 seconds.
- [button] Stop all
- [button] Wipe cache
- Horse never ships shared API keys. Each user brings their own credentials — this keeps the app self-hostable and avoids proxying anyone else's quota.


## Settings — Data

- [button] Edit
- [button] DiscoverTrending and top picks across movies & series (aria: Discover — Trending and top picks across movies & series)
- [button] LibraryWatchlist, continue watching and your collection (aria: Library — Watchlist, continue watching and your collection)
- [button] MoviesPopular, top rated and every movie genre (aria: Movies — Popular, top rated and every movie genre)
- [button] ShowsPopular series, top rated shows and genres (aria: Shows — Popular series, top rated shows and genres)
- [button] Live TVLIVEIPTV playlists and live channels (aria: Live TV — IPTV playlists and live channels)
- [button] CalendarAiring schedule for your series (aria: Calendar — Airing schedule for your series)
- [button] AddonsInstall and manage catalog & stream addons (aria: Addons — Install and manage catalog & stream addons)
- [button] CatalogsBrowse every catalog your addons provide (aria: Catalogs — Browse every catalog your addons provide)
- [button] WrappedYour viewing stats and yearly highlights (aria: Wrapped — Your viewing stats and yearly highlights)
#### Cloud sync
- Addons, settings, themes, watchlist, continue-watching and history are stored on this server (SQLite). Sign in to Stremio to restore them in any browser; without an account, sync keys to this device.
- Anonymous device key 82ad…9a4d · last sync 10:05:45 AM
- [switch] Toggle cloud sync
- [button] Sync now
- Export backup
- Save settings, addons, watchlist (0 items) to a .harbx file
- [button] Export
- Restore backup
- Import a .harbx backup file
- [button] Restore
- Clear local data
- Remove all Horse data from this browser
- [button] Clear
- Current settings size
- 1.7 KB in localStorage


## Settings — About

- [button] Edit
- [button] DiscoverTrending and top picks across movies & series (aria: Discover — Trending and top picks across movies & series)
- [button] LibraryWatchlist, continue watching and your collection (aria: Library — Watchlist, continue watching and your collection)
- [button] MoviesPopular, top rated and every movie genre (aria: Movies — Popular, top rated and every movie genre)
- [button] ShowsPopular series, top rated shows and genres (aria: Shows — Popular series, top rated shows and genres)
- [button] Live TVLIVEIPTV playlists and live channels (aria: Live TV — IPTV playlists and live channels)
- [button] CalendarAiring schedule for your series (aria: Calendar — Airing schedule for your series)
- [button] AddonsInstall and manage catalog & stream addons (aria: Addons — Install and manage catalog & stream addons)
- [button] CatalogsBrowse every catalog your addons provide (aria: Catalogs — Browse every catalog your addons provide)
- [button] WrappedYour viewing stats and yearly highlights (aria: Wrapped — Your viewing stats and yearly highlights)
### Horse
- [button] Install app
- An independent web client for the Stremio addon protocol — a web port of the Harbor desktop app by the Harbor project (github.com/harborstremio/harbor), MIT licensed.
- Horse is an independent, open-source media center for the Stremio addon protocol. It is not affiliated with Stremio. It hosts, indexes, and ships no media and bundles no content addons — users install their own addons.
- Licensed MIT. Attribution: Harbor desktop (github.com/harborstremio/harbor).
#### Keyboard shortcuts


## Sign in to Stremio (modal)

*Opened from the Sign in button in Settings.*

### Sign in to Stremio
- Your credentials go only to Stremio's official API through our server-side proxy — they are never stored or logged. Syncing imports your addons, watchlist and continue watching.
- Email
- input (placeholder: you@example.com)
- Password
- input (placeholder: ••••••••)
- [button] Sign in & sync
- Not affiliated with Stremio. You can also use Horse without an account.
- [button] Close


## Search

*Two captured states, query = “batman”.*

**State A — docked dropdown (desktop, after typing a query):**
- [button] AI
- [button] Clear search
- Movies
- [option] BatmanMovie · 1989
- [option] The BatmanMovie · 2022
- [option] Batman BeginsMovie · 2005
- [option] Batman: Knightfall - Part 1: KnightfallMovie · 2026
- Series
- [option] BatmanSeries · 1966-1968
- [option] Batman: The Animated SeriesSeries · 1992-1995
- [option] Batman: Caped CrusaderSeries · 2024-
- [option] Batman BeyondSeries · 1999-2001
- [option] See all results for “batman”Enter

**State B — full-screen search view:**
- [cards x8] under “Trending now”: PeddiMovie · | Spider-Man: Brand New DayMovie · | D54Movie · | Resident EvilMovie · | The OdysseyMovie · | RunnerMovie · | Hotel TehranMovie · | Tom Clancy's Jack Ryan: Ghost WarMovie ·
- [button] AI
- [button] Clear search
- Trending now

*(idle state additionally shows the Horse logo + wordmark lockup; back and clear buttons; the same overlay doubles as the command palette via `/` or Ctrl/Cmd+K; results grouped Movies / Series)*


## Title details — Movie

*Example: “Avengers: Endgame”. Hero order: title logo → meta chips → ratings → description → actions.*

- [cards x14] under “More like thisAction”: The Uprising | Spider-Man: Brand New Day | The End of Oak Street | Mayday | Disclosure Day | In the Grey | The Ministry of Ungentlemanly Warfare | X-Men | Good Luck, Have Fun, Don't Die | Star Wars: The Mandalorian and Grogu | The Gentlemen | Colony | Sinners | Inception
- [button] Back (aria: Go back)
## Avengers: Endgame
- chip: 2019
- chip: 8.4
- chip: 181 min
- chip: Action
- chip: Adventure
- chip: Sci-Fi
- [link] Trakt8.660K
- After the devastating events of Avengers: Infinity War (2018), the universe is in ruins. With the help of remaining allies, the Avengers assemble once more in order to reverse Thanos' actions and restore balance to the universe.
- [button] Play
- [button] Streams
- [button] Watchlist
- [button] Add to list
- Director
- Anthony Russo, Joe Russo
- Starring
- Robert Downey Jr., Chris Evans, Mark Ruffalo
[section “More like this”]
### More like this
- chip: Action


## Title details — Series (with Episodes)

*Example: “Breaking Bad”.*

- [cards x16] under “Season 0Season 1Season 2Season 3Season 4Season 5”: E1Live Free or Die7/16/As Walt deals with the aftermath of the Casa Tranquila explosion, Hank works to wrap up his investigation of Gus' empire. | E2Madrigal7/23/Walt and Jesse seek out an unlikely partner for a new business venture. The DEA follows up new leads in its investigation. | E3Hazard Pay7/30/Walt and Jesse put a business plan into action. Walt confesses a secret to Marie. | E4Fifty-One8/6/Walt celebrates another birthday. Skyler considers her options. An associate complicates Walt and Jesse's plan. | E5Dead Freight8/13/Walt's team must get creative to obtain the materials they need to continue their operation. | E6Buyout8/20/Walt, Jesse, and Mike struggle over the future of their business, as occupational hazards weigh on Jesse. | E7Say My Name8/27/Walt takes control of business matters as Mike grapples with the consequences of his actions. | E8Gliding Over All9/3/Walt ties up loose ends. Seeing the evidence of his success, he makes a startling and dangerous decision. | E9Blood Money8/12/As Walt and Jesse adjust to life out of the business, Hank grapples with a troubling lead. | E10Buried8/19/While Skyler's past catches up with her, Walt covers his tracks. Jesse continues to struggle with his guilt. | E11Confessions8/26/Jesse decides to make a change, while Walt and Skyler try to deal with an unexpected demand. | E12Rabid Dog9/2/An unusual strategy starts to bear fruit, while plans are set in motion that could change everything. | E13To'hajiilee9/9/Things heat up for Walt in unexpected ways. | E14Ozymandias9/16/Everyone copes with radically changed circumstances. | …
- [cards x14] under “More like thisCrime”: 8.42026Lanterns2026– | 8.32025MobLand2025– | 8.42022Slow Horses2022– | 8.02024The Gentlemen2024– | Neagley2026– | 8.02022Reacher2022– | 8.22008The Mentalist2008– | 9.02025Dexter: Resurrection2025– | Kill Jackie2026– | 6.82024Murder in a Small Town2024– | Last Seen2026– | 8.02018The Rookie2018– | 9.21999The Sopranos1999– | The Final Problem2026
- [button] Back (aria: Go back)
## Breaking Bad
- [link] Trakt9.373K
- A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine with a former student to secure his family's future.
- [button] Play
- [button] Streams
- [button] Watchlist
- [button] Add to list
- Starring
- Bryan Cranston, Aaron Paul, Anna Gunn
### Episodes
- [button] Oldest first
- [button] Season 0
- [button] Season 1
- [button] Season 2
- [button] Season 3
- [button] Season 4
- [button] Season 5
- E1Live Free or Die
- 7/16/2012
- As Walt deals with the aftermath of the Casa Tranquila explosion, Hank works to wrap up his investigation of Gus' empire.
- E2Madrigal
- 7/23/2012
- Walt and Jesse seek out an unlikely partner for a new business venture. The DEA follows up new leads in its investigation.
- E3Hazard Pay
- 7/30/2012
- Walt and Jesse put a business plan into action. Walt confesses a secret to Marie.
- E4Fifty-One
- 8/6/2012
- Walt celebrates another birthday. Skyler considers her options. An associate complicates Walt and Jesse's plan.
- E5Dead Freight
- 8/13/2012
- Walt's team must get creative to obtain the materials they need to continue their operation.
- E6Buyout
- 8/20/2012
- Walt, Jesse, and Mike struggle over the future of their business, as occupational hazards weigh on Jesse.
- E7Say My Name
- 8/27/2012
- Walt takes control of business matters as Mike grapples with the consequences of his actions.
- E8Gliding Over All
- 9/3/2012
- Walt ties up loose ends. Seeing the evidence of his success, he makes a startling and dangerous decision.
- E9Blood Money
- 8/12/2013
- As Walt and Jesse adjust to life out of the business, Hank grapples with a troubling lead.
- E10Buried
- 8/19/2013
- While Skyler's past catches up with her, Walt covers his tracks. Jesse continues to struggle with his guilt.
- E11Confessions
- 8/26/2013
- Jesse decides to make a change, while Walt and Skyler try to deal with an unexpected demand.
- E12Rabid Dog
- 9/2/2013
- An unusual strategy starts to bear fruit, while plans are set in motion that could change everything.
- E13To'hajiilee
- 9/9/2013
- Things heat up for Walt in unexpected ways.
- E14Ozymandias
- 9/16/2013
- Everyone copes with radically changed circumstances.
- E15Granite State
- 9/23/2013
- Events set in motion long ago move toward a conclusion.
- E16Felina
- 9/30/2013
- All bad things must come to an end.
[section “More like this”]
### More like this
- [button] 8.42026 (aria: Lanterns)
- Lanterns
- 2026–
- [button] 8.32025 (aria: MobLand)
- MobLand
- 2025–
- [button] 8.42022 (aria: Slow Horses)
- Slow Horses
- 2022–
- [button] 8.02024 (aria: The Gentlemen)
- The Gentlemen
- 2024–
- [button] 2026 (aria: Neagley)
- Neagley
- 2026–
- [button] 8.02022 (aria: Reacher)
- Reacher
- 2022–
- [button] 8.22008 (aria: The Mentalist)
- The Mentalist
- 2008–2015
- [button] 9.02025 (aria: Dexter: Resurrection)
- Dexter: Resurrection
- 2025–
- [button] 2026 (aria: Kill Jackie)
- Kill Jackie
- 2026–
- [button] 6.82024 (aria: Murder in a Small Town)
- Murder in a Small Town
- 2024–
- [button] 2026 (aria: Last Seen)
- Last Seen
- 2026–
- [button] 8.02018 (aria: The Rookie)
- The Rookie
- 2018–
- [button] 9.21999 (aria: The Sopranos)
- The Sopranos
- 1999–2007
- [button] 2026 (aria: The Final Problem)
- The Final Problem
- 2026


## Stream picker (dialog)

*No addons installed in this environment, so no stream rows — filters and actions are the stable UI. With addons, rows list quality/size/source per stream.*

- [button] Back (aria: Go back)
[dialog “Stream picker”]
### Choose a stream
- tt0903747
- [button] Refresh streams
- [button] Close picker
- chip: All
- chip: Free
- chip: Cached
- chip: 4K
- chip: 1080p
- chip: Showing all
- input (placeholder: Filter…; label: Filter streams)


## Add-to-list popover

*Opens from the Add to list button on a title details page; with existing lists it shows them as checkable rows.*

- No lists yet — create your first one below.
- [button] New list


## Player controls (dialog)

*Control bar auto-shows on pointer move. Time display toggles between elapsed and remaining; shows “length unknown” when a stream hides its duration.*

[dialog “Playing Big Buck Bunny (Demo)”]
- [button] Play (Space)
- [button] Back 10s
- [button] Forward 10s
- [button] Unmute (M)
- input (label: Volume)
- [button] 0:10 / -10:24 (aria: Time: 10 seconds of 10 minutes 34 seconds. Activate to toggle remaining time display.)
- [button] Subtitles (S)
- [button] Playback settings
- [button] Picture in picture (U)
- [button] Fullscreen (F)
- [button] Close player (Esc)
- Big Buck Bunny (Demo)
- [button] Streams

---
*End of extraction — 21 sections. Dynamic catalog rows (titles/years/ratings) change with the installed addons and Stremio/TMDB catalogs; all UI strings above are stable.*