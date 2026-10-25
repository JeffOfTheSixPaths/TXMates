import type { Activity, ActivityCategory } from '@/types';
import { CATEGORY_LABELS } from './activityCategory';

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';
export type CuratedCity = 'Austin' | 'Houston' | 'Dallas' | 'San Antonio';

type Seed = {
  id: string;
  name: string;
  city: CuratedCity;
  area: string;
  category: ActivityCategory;
  cost: number;
  windows: DayPart[];
  blurb: string;
  url?: string;
  signature?: boolean;
  minutes?: number;
};

const MINUTES: Record<ActivityCategory, number> = {
  food: 75,
  music: 120,
  outdoors: 90,
  gaming: 105,
  sports: 90,
  nightlife: 90,
  arts: 90,
  chill: 60,
};

const WINDOW_TEXT: Record<DayPart, string> = {
  morning: 'Morning (8 AM - 11 AM)',
  afternoon: 'Afternoon (12 PM - 5 PM)',
  evening: 'Evening (5 PM - 9 PM)',
  night: 'Night (8 PM - 12 AM)',
};

function v(
  id: string,
  name: string,
  city: CuratedCity,
  area: string,
  category: ActivityCategory,
  cost: number,
  windows: DayPart[],
  blurb: string,
  url?: string,
  signature?: boolean
): Seed {
  return { id, name, city, area, category, cost, windows, blurb, url, signature };
}

const A = 'afternoon' as const;
const E = 'evening' as const;
const M = 'morning' as const;
const N = 'night' as const;

const VENUES: Seed[] = [
  // Austin — Food & BBQ
  v('franklin-barbecue', 'Franklin Barbecue', 'Austin', 'East Austin', 'food', 28, [A, E], 'The East 11th brisket joint. The line is part of the hangout, and the picnic tables hold a group.', 'https://franklinbarbecue.com', true),
  v('terry-blacks', "Terry Black's Barbecue", 'Austin', 'South Lamar', 'food', 26, [A, E], 'Barton Springs Road barbecue with a big patio and a line that moves. Easy to feed a whole group.', 'https://www.terryblacksbbq.com'),
  v('la-barbecue', 'la Barbecue', 'Austin', 'East Austin', 'food', 27, [A], 'East Austin brisket, ribs, and sides. Counter service and outdoor tables.'),
  v('matts-el-rancho', "Matt's El Rancho", 'Austin', 'South Lamar', 'food', 22, [A, E], 'Tex-Mex institution since the 1950s. Bob Armstrong dip and booths that actually fit a group.', 'https://www.mattselrancho.com'),
  v('gueros', "Güero's Taco Bar", 'Austin', 'South Congress', 'food', 18, [A, E], 'South Congress patio, chips on the table, and a menu everyone already knows.', 'https://www.guerostacobar.com'),
  v('home-slice', 'Home Slice Pizza', 'Austin', 'South Congress', 'food', 18, [A, E, N], 'New York slices on South Congress. The sidewalk tables are the move when the dining room is full.', 'https://homeslicepizza.com'),
  v('juan-in-a-million', 'Juan in a Million', 'Austin', 'East Cesar Chavez', 'food', 14, [M, A], 'Breakfast-taco landmark on East Cesar Chavez. The Don Juan is the order.'),
  v('hoovers', "Hoover's Cooking", 'Austin', 'East Austin', 'food', 18, [A, E], 'Comfort-food dining room on Manor Road. Fried chicken, meatloaf, and enough seats for a crew.'),

  // Austin — Live Music
  v('continental-club', 'Continental Club', 'Austin', 'South Congress', 'music', 18, [E, N], 'South Congress music room since 1955. Early show or late show, the room is the point.', 'https://www.continentalclub.com', true),
  v('broken-spoke', 'Broken Spoke', 'Austin', 'South Lamar', 'music', 15, [E, N], 'Dance hall and chicken-fried steak since 1964. Two-stepping is optional. Staying for the band is not.', 'https://www.brokenspokeaustintx.net'),
  v('saxon-pub', 'Saxon Pub', 'Austin', 'South Lamar', 'music', 15, [E, N], 'A listening room on South Lamar with songwriters most nights and a low cover.', 'https://www.thesaxonpub.com'),
  v('white-horse', 'The White Horse', 'Austin', 'East Austin', 'music', 12, [N], 'East Austin honky-tonk. Live bands, a wood floor, and cheap beer.', 'https://www.thewhitehorseaustin.com'),
  v('antones', "Antone's Nightclub", 'Austin', 'Downtown', 'music', 25, [N], 'The blues club Austin has kept alive since the 1970s, now on 5th Street.', 'https://www.antonesnightclub.com'),
  v('mohawk', 'Mohawk', 'Austin', 'Red River', 'music', 20, [N], 'Indoor room and an outdoor stage on Red River. The block is the rest of the night.', 'https://mohawkaustin.com'),
  v('elephant-room', 'The Elephant Room', 'Austin', 'Downtown', 'music', 15, [N], 'Basement jazz on Congress Avenue. Every night, small room, no guessing.'),
  v('hole-in-the-wall', 'Hole in the Wall', 'Austin', 'The Drag', 'music', 10, [E, N], 'Guadalupe dive with bands since the 1970s. Cash-friendly and a block from campus.'),
  v('c-boys', "C-Boy's Heart & Soul", 'Austin', 'South Congress', 'music', 15, [E, N], 'South Congress soul and funk room. The early set is the one that still has seats.'),

  // Austin — Outdoors & Springs
  v('barton-springs', 'Barton Springs Pool', 'Austin', 'Zilker', 'outdoors', 5, [M, A], 'The spring-fed pool in Zilker. Cold water, a grassy hill, and the clearest Austin afternoon there is.', 'https://www.austintexas.gov/department/barton-springs-pool', true),
  v('zilker-park', 'Zilker Park', 'Austin', 'Zilker', 'outdoors', 0, [M, A, E], 'The big lawn between the springs and the lake. Blankets, a frisbee, and no ticket.', 'https://www.austintexas.gov/zilker'),
  v('lady-bird-trail', 'Ann and Roy Butler Hike-and-Bike Trail', 'Austin', 'Lady Bird Lake', 'outdoors', 0, [M, A, E], 'The loop around Lady Bird Lake. Skyline on one side, shade on the other.'),
  v('mount-bonnell', 'Mount Bonnell', 'Austin', 'Covert Park', 'outdoors', 0, [A, E], 'The stone steps over Lake Austin. Short climb, long view, best before sunset.'),
  v('mckinney-falls', 'McKinney Falls State Park', 'Austin', 'Southeast Austin', 'outdoors', 6, [M, A], 'Waterfalls and flat trails inside the city limits. A real park, not a patio with a tree.'),
  v('mayfield-park', 'Mayfield Park and Preserve', 'Austin', 'West Austin', 'outdoors', 0, [M, A], 'Peacocks, a cottage garden, and a short trail off 35th Street.'),
  v('deep-eddy', 'Deep Eddy Pool', 'Austin', 'Tarrytown', 'outdoors', 5, [A], 'The city pool that has been here since the 1910s. Lap swim or just the cold water.'),
  v('rowing-dock', 'Rowing Dock', 'Austin', 'Zilker', 'outdoors', 25, [A, E], 'Kayaks and paddleboards on Lady Bird Lake, a short walk from the springs.', 'https://www.rowingdock.com'),

  // Austin — Gaming & Arcades
  v('cidercade-austin', 'Cidercade Austin', 'Austin', 'Riverside', 'gaming', 15, [A, E, N], 'Free-play arcade on Riverside with a lake-side patio. One cover, then you stay.', 'https://cidercade.com/austin', true),
  v('pinballz', 'Pinballz Kingdom', 'Austin', 'North Austin', 'gaming', 15, [A, E, N], 'A huge pinball and arcade floor on the north side. League night is loud. Afternoons are easier.', 'https://www.pinballzarcade.com'),
  v('peter-pan', 'Peter Pan Mini-Golf', 'Austin', 'Barton Springs Road', 'gaming', 10, [A, E], 'The 1948 mini-golf course next to the springs. BYOB, short round, very Austin.'),
  v('emerald-tavern', 'Emerald Tavern', 'Austin', 'Riverside', 'gaming', 15, [A, E, N], 'Board-game cafe with a wall of games and food that shows up while you play.'),
  v('dragons-lair', "Dragon's Lair Comics & Fantasy", 'Austin', 'South Lamar', 'gaming', 12, [A, E], 'The long-running South Lamar game shop. Easy drop-in for cards, comics, and a group argument.'),
  v('dart-bowl', 'Dart Bowl', 'Austin', 'North Austin', 'gaming', 14, [E, N], 'A classic Austin bowling alley on Grover. Lanes, a bar, and no reservation theater.'),
  v('escape-game-austin', 'The Escape Game Austin', 'Austin', 'The Domain', 'gaming', 36, [A, E, N], 'Story rooms at the Domain. Book one room so the group stays together.', 'https://theescapegame.com'),

  // Austin — Sports & Active
  v('q2-stadium', 'Q2 Stadium', 'Austin', 'North Austin', 'sports', 40, [A, E], 'Austin FC at Q2. Even a non-match day, the plaza is the north-side meetup.', 'https://www.austinfc.com'),
  v('abp', 'Austin Bouldering Project', 'Austin', 'East Austin', 'sports', 22, [A, E], 'The big East Austin bouldering gym. Rent shoes, stay on the beginner wall, then the cafe.', 'https://austinboulderingproject.com'),
  v('butler-pitch', 'Butler Pitch & Putt', 'Austin', 'Zilker', 'sports', 16, [A, E], 'Nine short holes under the oaks by the lake. A round that does not take the whole day.'),
  v('cota', 'Circuit of the Americas', 'Austin', 'Southeast Austin', 'sports', 35, [A], 'The race track southeast of town. Tours and event days, not a random Tuesday drive-by.', 'https://www.circuitoftheamericas.com'),
  v('muny', 'Lions Municipal Golf Course', 'Austin', 'West Austin', 'sports', 22, [M, A], 'The Muny, a historic public course off Enfield. A nine is enough.'),
  v('greenbelt', 'Barton Creek Greenbelt', 'Austin', 'Zilker', 'sports', 0, [M, A], 'The trail from Spyglass or the Sculpture Falls end. Swim holes when the water is up.'),
  v('topgolf-austin', 'Topgolf Austin', 'Austin', 'The Domain', 'sports', 30, [A, E, N], 'Bay hits at the Domain. Nobody has to be good, and the food shows up at the bay.'),

  // Austin — Nightlife & Drinks
  v('driskill-bar', 'The Driskill Bar', 'Austin', 'Downtown', 'nightlife', 22, [E, N], 'The hotel bar inside the Driskill, open in one form since the 1880s. One round, leather chairs, Congress Avenue outside.'),
  v('little-longhorn', 'Little Longhorn Saloon', 'Austin', 'Burnet Road', 'nightlife', 12, [E, N], "Ginny's Little Longhorn. Chicken-shit bingo when it is on, a honky-tonk the rest of the time."),
  v('whislers', "Whisler's", 'Austin', 'East Sixth', 'nightlife', 18, [E, N], 'Mezcal bar on East Sixth with a backyard and a food window.'),
  v('abgb', 'Austin Beer Garden Brewing Co.', 'Austin', 'South Austin', 'nightlife', 18, [A, E], 'The ABGB on Oltorf. Long tables, house beer, and a pizza window.', 'https://theabgb.com'),
  v('nickel-city', 'Nickel City', 'Austin', 'East Eleventh', 'nightlife', 14, [A, E, N], 'A neighborhood bar on East 11th with frozen drinks and a patio that fits a standing group.'),
  v('lazarus', 'Lazarus Brewing Co.', 'Austin', 'East Sixth', 'nightlife', 16, [A, E], 'Brewery taproom on East Sixth. Easy first round before the rest of the street.'),
  v('oilcan-harrys', "Oilcan Harry's", 'Austin', 'Warehouse District', 'nightlife', 15, [N], 'The long-running downtown dance bar on 4th. Go late or pick somewhere quieter.'),
  v('jester-king', 'Jester King Brewery', 'Austin', 'Fitzhugh', 'nightlife', 20, [A, E], 'Hill-country brewery west of town. Pizza, picnic tables, and an afternoon that runs long.'),

  // Austin — Arts & Culture
  v('blanton', 'Blanton Museum of Art', 'Austin', 'UT Campus', 'arts', 12, [A], 'The campus museum and the Ellsworth Kelly chapel. Air conditioning and a real collection.', 'https://blantonmuseum.org', true),
  v('bullock', 'Bullock Texas State History Museum', 'Austin', 'Downtown', 'arts', 16, [A], 'The Texas museum at the capitol complex. A full afternoon if the group likes a story.', 'https://www.thestoryoftexas.com'),
  v('umlauf', 'Umlauf Sculpture Garden & Museum', 'Austin', 'Zilker', 'arts', 7, [M, A], 'Sculpture in a shaded garden between Zilker and the lake.'),
  v('mexic-arte', 'Mexic-Arte Museum', 'Austin', 'Congress Avenue', 'arts', 8, [A], 'The downtown Mexican and Mexican-American art museum on Congress.'),
  v('capitol', 'Texas State Capitol', 'Austin', 'Downtown', 'arts', 0, [M, A], 'The granite capitol and its grounds. Free, central, and better than it looks from the car.'),
  v('ransom-center', 'Harry Ransom Center', 'Austin', 'UT Campus', 'arts', 0, [A], 'UT gallery with a Gutenberg Bible and rotating shows. Free, and an hour is enough.'),
  v('laguna-gloria', 'The Contemporary Austin at Laguna Gloria', 'Austin', 'West Austin', 'arts', 10, [A], 'The lakeside art campus on 35th. Grounds first, galleries if they are open.'),
  v('paramount', 'Paramount Theatre', 'Austin', 'Congress Avenue', 'arts', 30, [E, N], 'The 1915 movie palace on Congress. Go when something is actually on the marquee.', 'https://www.austintheatre.org'),

  // Austin — Cafe & Social Chill
  v('mozarts', "Mozart's Coffee Roasters", 'Austin', 'Lake Austin', 'chill', 12, [M, A, E], 'The deck over Lake Austin. Sunset is the reason. Coffee is the excuse.', 'https://www.mozartscoffee.com', true),
  v('jos-coffee', "Jo's Coffee", 'Austin', 'South Congress', 'chill', 8, [M, A], 'The South Congress coffee stand and the mural wall. Ten minutes or an hour.', 'https://www.joscoffee.com'),
  v('radio-coffee', 'Radio Coffee & Beer', 'Austin', 'South Manchaca', 'chill', 12, [M, A], 'South Austin coffee bar with a yard. Easy place to start before the day costs money.'),
  v('bennu', 'Bennu Coffee', 'Austin', 'East Austin', 'chill', 8, [M, A, N], 'The long-running East MLK coffeehouse. Open late, tables for a laptop or a real conversation.'),
  v('epoch', 'Epoch Coffee', 'Austin', 'North Loop', 'chill', 8, [M, A, E], 'North Loop coffee shop that has outlasted the block around it.'),
  v('quacks', "Quack's 43rd Street Bakery", 'Austin', 'Hyde Park', 'chill', 10, [M, A], 'Hyde Park bakery and coffee. Kolaches, a porch, and a neighborhood pace.'),
  v('cherrywood', 'Cherrywood Coffeehouse', 'Austin', 'Cherrywood', 'chill', 8, [M, A], 'The Cherrywood bungalow coffeehouse. Order at the window and sit outside.'),
  v('flat-track', 'Flat Track Coffee', 'Austin', 'North Lamar', 'chill', 8, [M, A], 'North Lamar roaster and cafe. A clean hour before everyone is hungry.'),

  // Houston — Food & BBQ
  v('ninfas', "The Original Ninfa's on Navigation", 'Houston', 'East End', 'food', 22, [A, E], 'The Navigation Boulevard original. Fajitas started here, and the patio still feels like Houston.', 'https://ninfas.com', true),
  v('breakfast-klub', 'The Breakfast Klub', 'Houston', 'Midtown', 'food', 16, [M, A], 'Midtown breakfast line on Travis. Chicken and waffles, and you will wait.', 'https://www.thebreakfastklub.com'),
  v('goode-bbq', 'Goode Company Barbecue', 'Houston', 'Upper Kirby', 'food', 24, [A, E], 'Kirby Drive barbecue with the mesquite pits and the pecan pie.'),
  v('pizzitolas', "Pizzitola's Bar-B-Cue", 'Houston', 'Garden Oaks', 'food', 22, [A], 'Shepherd Drive barbecue that has been in the same family orbit since the 1930s.'),
  v('barbecue-inn', 'Barbecue Inn', 'Houston', 'Northside', 'food', 18, [A, E], 'East Crosstimbers diner and barbecue, open since the 1940s.'),
  v('this-is-it', 'This Is It Soul Food', 'Houston', 'Third Ward', 'food', 16, [A, E], 'Blodgett Street soul food since 1959. The dining room is small. Go hungry.'),
  v('el-real', 'El Real Tex-Mex Cafe', 'Houston', 'Montrose', 'food', 20, [A, E], 'Tex-Mex in the old Tower Theatre on Westheimer.'),
  v('irmas', "Irma's", 'Houston', 'Downtown', 'food', 18, [A], 'Downtown Mexican and Gulf cooking near the ballpark. Lunch is the sweet spot.'),
  v('truth-bbq', 'Truth BBQ', 'Houston', 'The Heights', 'food', 28, [A, E], 'Heights barbecue with trays and sides built for a group that cannot agree.'),
  v('hugos', "Hugo's", 'Houston', 'Montrose', 'food', 34, [E], 'Interior Mexican on Westheimer. The nicer dinner if the budget can take it.', 'https://hugosrestaurant.net'),

  // Houston — Live Music
  v('last-concert', 'Last Concert Cafe', 'Houston', 'Near Northside', 'music', 15, [E, N], 'Patio and a stage on Nance, going since the 1940s. Houston in one backyard.'),
  v('mucky-duck', "McGonigel's Mucky Duck", 'Houston', 'Upper Kirby', 'music', 25, [E, N], 'Listening room on Norfolk for songwriters and folk. Seats, not a crush.', 'https://www.mcgonigels.com'),
  v('continental-houston', 'Continental Club Houston', 'Houston', 'Midtown', 'music', 15, [E, N], 'The Houston room of the Austin club, on Main Street. Early set, then Midtown.'),
  v('white-oak', 'White Oak Music Hall', 'Houston', 'Near Northside', 'music', 25, [E, N], 'Indoor stage and a lawn on North Main. Check the bill, then go.', 'https://www.whiteoakmusichall.com'),
  v('heights-theater', 'The Heights Theater', 'Houston', 'The Heights', 'music', 30, [E], 'The 1920s movie theater on 19th Street, now a seated music room.', 'https://www.theheightstheater.com'),
  v('miller', 'Miller Outdoor Theatre', 'Houston', 'Hermann Park', 'music', 0, [E], 'Free shows in the Hermann Park hill. Bring a blanket if something is on.', 'https://www.milleroutdoortheatre.com', true),
  v('hob-houston', 'House of Blues Houston', 'Houston', 'Downtown', 'music', 30, [N], 'Downtown room on Caroline when a bill is posted. Skip it on a dark night.'),
  v('dan-electros', "Dan Electro's Guitar Bar", 'Houston', 'The Heights', 'music', 10, [E, N], 'A Heights guitar bar with small bands and no fuss.'),

  // Houston — Outdoors
  v('discovery-green', 'Discovery Green', 'Houston', 'Downtown', 'outdoors', 0, [M, A, E], 'The downtown park between the convention center and the ballpark. Lawn, lake, and food nearby.', 'https://www.discoverygreen.com', true),
  v('hermann-park', 'Hermann Park', 'Houston', 'Museum District', 'outdoors', 0, [M, A, E], 'The Central Park of Houston. The reflecting pool, the train, and the museum walk.', 'https://www.hermannpark.org'),
  v('buffalo-bayou', 'Buffalo Bayou Park', 'Houston', 'Downtown', 'outdoors', 0, [M, A, E], 'The trails and lawns west of downtown along the bayou. Skyline the whole way.', 'https://buffalobayou.org'),
  v('memorial-park', 'Memorial Park', 'Houston', 'Memorial', 'outdoors', 0, [M, A], 'The huge park inside the loop. The running trails and the eastern glade.'),
  v('arboretum-houston', 'Houston Arboretum & Nature Center', 'Houston', 'Memorial Park', 'outdoors', 0, [M, A], 'Shaded trails on the Memorial Park edge. Cooler than a sidewalk.'),
  v('waterwall', 'Gerald D. Hines Waterwall Park', 'Houston', 'Uptown', 'outdoors', 0, [A, E], 'The Uptown fountain wall. Ten minutes of noise and a photo, then dinner.'),
  v('mcgovern-gardens', 'McGovern Centennial Gardens', 'Houston', 'Hermann Park', 'outdoors', 0, [M, A], 'The garden inside Hermann Park. A slow loop if the museum was a lot.'),
  v('houston-zoo', 'Houston Zoo', 'Houston', 'Hermann Park', 'outdoors', 23, [M, A], 'The zoo on the Hermann Park edge. A whole afternoon with shade breaks.', 'https://www.houstonzoo.org'),

  // Houston — Gaming
  v('cidercade-houston', 'Cidercade Houston', 'Houston', 'EaDo', 'gaming', 15, [A, E, N], 'Free-play arcade on Canal Street in EaDo, next to the ballpark side of downtown.', 'https://cidercade.com/houston', true),
  v('dave-busters-houston', "Dave & Buster's Houston", 'Houston', 'Memorial City', 'gaming', 28, [A, E, N], 'The Katy Freeway arcade and sports bar. One card, many arguments.', 'https://www.daveandbusters.com'),
  v('main-event-stafford', 'Main Event Stafford', 'Houston', 'Stafford', 'gaming', 25, [A, E, N], 'Bowling, arcade, and laser tag southwest of town. Built for a group that cannot pick one game.'),
  v('escape-game-houston', 'The Escape Game Houston', 'Houston', 'CityCentre', 'gaming', 36, [A, E, N], 'Escape rooms at CityCentre. Book ahead so the slot is real.', 'https://theescapegame.com/houston'),
  v('andretti-katy', 'Andretti Indoor Karting & Games', 'Houston', 'Katy', 'gaming', 32, [A, E, N], 'Karts, arcade, and bowling in Katy. The west-side version of a group night.', 'https://andrettikarting.com/katy'),
  v('del-mar-lanes', 'Del Mar Lanes', 'Houston', 'West Houston', 'gaming', 14, [E, N], 'A Houston bowling alley that has been open since the 1950s. Lanes, not a theme.'),
  v('bowl-barrel', 'Bowl & Barrel', 'Houston', 'CityCentre', 'gaming', 22, [E, N], 'Lanes and a bar at CityCentre. Easier than driving to Katy.'),
  v('palace-social', 'Palace Social', 'Houston', 'Bellaire', 'gaming', 22, [A, E, N], 'Bowling and arcade on Bellaire Boulevard.'),

  // Houston — Sports
  v('daikin-park', 'Daikin Park', 'Houston', 'Downtown', 'sports', 35, [E, N], 'The Astros ballpark downtown, a short walk from Discovery Green and EaDo.', 'https://www.mlb.com/astros', true),
  v('nrg', 'NRG Stadium', 'Houston', 'NRG Park', 'sports', 45, [A, E], 'Texans and the big shows at NRG Park. Only when there is an event.'),
  v('toyota-center', 'Toyota Center', 'Houston', 'Downtown', 'sports', 40, [E, N], 'Rockets nights downtown. Pair it with a walk, not a second far-flung stop.', 'https://www.toyotacenter.com'),
  v('shell-energy', 'Shell Energy Stadium', 'Houston', 'EaDo', 'sports', 25, [E], 'Dynamo matches in EaDo. Easier to reach than NRG, and the neighborhood has dinner.'),
  v('topgolf-houston', 'Topgolf Houston', 'Houston', 'Spring', 'sports', 30, [A, E, N], 'A driving-range bay north of town. Fine if the group is already on that side.'),
  v('memorial-trails', 'Memorial Park Running Trails', 'Houston', 'Memorial', 'sports', 0, [M, A, E], 'The loop inside Memorial Park. Three miles or a short out-and-back.'),
  v('ifly-houston', 'iFLY Houston', 'Houston', 'Memorial City', 'sports', 50, [A, E], 'Indoor skydiving on the west side. One flight each, then you are done.'),
  v('bayou-kayak', 'Buffalo Bayou kayaking', 'Houston', 'Downtown', 'sports', 25, [M, A], 'A paddle on the bayou downtown. Morning is calmer than a Saturday noon.'),

  // Houston — Nightlife
  v('la-carafe', 'La Carafe', 'Houston', 'Downtown', 'nightlife', 14, [E, N], 'A tiny wine bar on Congress in one of the oldest buildings downtown. Go early enough to get in.', undefined, true),
  v('anvil', 'Anvil Bar & Refuge', 'Houston', 'Montrose', 'nightlife', 20, [E, N], 'The Montrose cocktail bar that reset Houston drinks. One round is the right length.', 'https://www.anvilhouston.com'),
  v('saint-arnold', 'Saint Arnold Brewing Company', 'Houston', 'Near Northside', 'nightlife', 16, [A, E], 'Texas’s oldest craft brewery, on Lyons Avenue. The beer hall holds a group.', 'https://www.saintarnold.com'),
  v('west-alabama', 'West Alabama Ice House', 'Houston', 'Montrose', 'nightlife', 12, [A, E, N], 'The Montrose icehouse. Picnic tables, cold beer, no script.'),
  v('poison-girl', 'Poison Girl', 'Houston', 'Montrose', 'nightlife', 12, [E, N], 'Westheimer dive with a backyard. A second stop, not a dinner.'),
  v('axelrad', 'Axelrad Beer Garden', 'Houston', 'Midtown', 'nightlife', 16, [A, E, N], 'The big Midtown beer yard. Food trucks and enough room to lose someone and find them.'),
  v('eighth-wonder', '8th Wonder Brewery', 'Houston', 'EaDo', 'nightlife', 15, [A, E], 'Brewery taproom in EaDo. Walkable to the ballpark side of downtown.'),
  v('karbach', 'Karbach Brewing Co.', 'Houston', 'The Heights', 'nightlife', 15, [A, E], 'The Heights brewery. A tour if they want it, the beer hall if they do not.', 'https://www.karbachbrewing.com'),

  // Houston — Arts
  v('mfah', 'Museum of Fine Arts, Houston', 'Houston', 'Museum District', 'arts', 16, [A], 'The MFAH campus on Bissonnet. Pick one building so the afternoon stays fun.', 'https://www.mfah.org', true),
  v('menil', 'The Menil Collection', 'Houston', 'Montrose', 'arts', 0, [A], 'Free galleries in Montrose. Quiet, serious, and the right length for a group.', 'https://www.menil.org'),
  v('rothko', 'Rothko Chapel', 'Houston', 'Montrose', 'arts', 0, [A], 'The chapel next to the Menil. A short stop. Voices down.', 'https://www.rothkochapel.org'),
  v('hmns', 'Houston Museum of Natural Science', 'Houston', 'Hermann Park', 'arts', 20, [M, A], 'Dinosaurs, energy, and the butterfly center in Hermann Park.', 'https://www.hmns.org'),
  v('camh', 'Contemporary Arts Museum Houston', 'Houston', 'Museum District', 'arts', 0, [A], 'The stainless-steel parallelogram across from the MFAH. Free, and smaller than it looks.', 'https://camh.org'),
  v('space-center', 'Space Center Houston', 'Houston', 'Clear Lake', 'arts', 30, [M, A], 'The visitor center for Johnson Space Center. A half-day, so do not pair it with a west-side dinner.', 'https://www.spacecenter.org'),
  v('alley-theatre', 'Alley Theatre', 'Houston', 'Downtown', 'arts', 35, [E], 'The downtown theater company. Only when a show is on the board.', 'https://www.alleytheatre.org'),
  v('orange-show', 'The Orange Show', 'Houston', 'East End', 'arts', 10, [A], 'The folk-art monument on Munger Street. Weird, short, and very Houston.'),

  // Houston — Chill
  v('agora', 'Agora', 'Houston', 'Montrose', 'chill', 8, [M, A, E], 'The Montrose coffeehouse Houston has been sitting in for decades.'),
  v('three-brothers', 'Three Brothers Bakery', 'Houston', 'Braeswood', 'chill', 10, [M, A], 'The Braeswood bakery, open since 1949. Cakes in the case, coffee if you are staying.', 'https://www.3brothersbakery.com'),
  v('el-bolillo', 'El Bolillo Bakery', 'Houston', 'The Heights', 'chill', 8, [M, A], 'Pan dulce on Airline Drive. Go in the morning and eat outside.'),
  v('boomtown', 'Boomtown Coffee', 'Houston', 'The Heights', 'chill', 8, [M, A], 'Heights coffee shop for the first hour of the day, before anyone needs a plan.'),
  v('blacksmith-coffee', 'Blacksmith', 'Houston', 'The Heights', 'chill', 8, [M, A], 'A Heights coffee bar. Small, serious about the cup, easy to leave.'),
  v('empire-cafe', 'Empire Cafe', 'Houston', 'Montrose', 'chill', 14, [M, A], 'Westheimer cafe the neighborhood has used as a living room for years.'),
  v('catalina', 'Catalina Coffee', 'Houston', 'Washington Avenue', 'chill', 8, [M, A], 'Washington Avenue coffee. A start, not the whole hangout.'),
  v('tout-suite', 'Tout Suite', 'Houston', 'EaDo', 'chill', 14, [M, A], 'Cafe in EaDo. Useful when the group is already downtown for the park or the ballpark.'),

  // Dallas — Food
  v('pecan-lodge', 'Pecan Lodge', 'Dallas', 'Deep Ellum', 'food', 26, [A, E], 'Deep Ellum barbecue. Burnt ends, a tray, and the sidewalk if the room is full.', 'https://pecanlodge.com', true),
  v('sonny-bryans', "Sonny Bryan's Smokehouse", 'Dallas', 'Inwood', 'food', 18, [A], 'The Inwood smokehouse Dallas has lined up at since 1958.'),
  v('cattleack', 'Cattleack Barbeque', 'Dallas', 'Farmers Branch', 'food', 28, [A], 'Farmers Branch barbecue with short hours. Go when they are actually open.'),
  v('el-fenix', 'El Fenix', 'Dallas', 'Downtown', 'food', 16, [A, E], 'Tex-Mex Dallas has had since 1918. Cheese enchiladas, a booth, no debate.', 'https://www.elfenix.com'),
  v('campisis', "Campisi's Restaurant", 'Dallas', 'Mockingbird', 'food', 22, [E, N], 'The Egyptian Lounge on Mockingbird, red sauce and a checkered table since the 1940s.'),
  v('the-mecca', 'The Mecca Restaurant', 'Dallas', 'Harry Hines', 'food', 14, [M, A], 'Breakfast and chicken-fried steak on Harry Hines since the 1930s.'),
  v('mias', "Mia's Tex-Mex", 'Dallas', 'Lemmon Avenue', 'food', 18, [A, E], 'Lemmon Avenue Tex-Mex. Brisket tacos and a room that expects a group.'),
  v('normas', "Norma's Cafe", 'Dallas', 'Oak Cliff', 'food', 14, [M, A], 'Oak Cliff diner food. Pancakes or chicken-fried steak, depending on the hour.'),
  v('kubys', "Kuby's Sausage House", 'Dallas', 'Snider Plaza', 'food', 16, [M, A], 'Sausage house in Snider Plaza since 1961. Lunch, not a late night.'),
  v('lockhart-smokehouse', 'Lockhart Smokehouse', 'Dallas', 'Bishop Arts', 'food', 24, [A, E], 'Bishop Arts barbecue. Easy to pair with a walk on Davis.'),

  // Dallas — Music
  v('granada', 'Granada Theater', 'Dallas', 'Lower Greenville', 'music', 30, [E, N], 'The Greenville Avenue theater. A seated or standing show, then the street.', 'https://www.granadatheater.com', true),
  v('kessler', 'The Kessler Theater', 'Dallas', 'Oak Cliff', 'music', 25, [E], 'Oak Cliff listening room in a restored theater. Sit down, hear the song.', 'https://www.thekessler.org'),
  v('trees', 'Trees', 'Dallas', 'Deep Ellum', 'music', 20, [N], 'The Deep Ellum rock room. Check the bill. The block will keep you after.'),
  v('bomb-factory', 'The Bomb Factory', 'Dallas', 'Deep Ellum', 'music', 30, [N], 'The big Deep Ellum room on Canton. Only worth it when the poster is good.'),
  v('adairs', "Adair's Saloon", 'Dallas', 'Deep Ellum', 'music', 12, [E, N], 'Deep Ellum honky-tonk. Burgers, bands, and walls of stickers.'),
  v('hob-dallas', 'House of Blues Dallas', 'Dallas', 'Victory Park', 'music', 30, [N], 'Victory Park room next to the arena. Useful on a show night, skip it otherwise.'),
  v('meyerson', 'Morton H. Meyerson Symphony Center', 'Dallas', 'Arts District', 'music', 30, [E], 'The I. M. Pei hall in the Arts District. A concert, not a drop-in.', 'https://www.dallassymphony.org'),
  v('club-dada', 'Club Dada', 'Dallas', 'Deep Ellum', 'music', 15, [N], 'A Deep Ellum stage with a long run. Smaller than the Bomb Factory, which is the point.'),

  // Dallas — Outdoors
  v('klyde-warren', 'Klyde Warren Park', 'Dallas', 'Downtown', 'outdoors', 0, [M, A, E], 'The deck park over Woodall Rodgers. Food trucks, a lawn, and the Arts District on both sides.', 'https://www.klydewarrenpark.org', true),
  v('dallas-arboretum', 'Dallas Arboretum and Botanical Garden', 'Dallas', 'White Rock Lake', 'outdoors', 20, [M, A], 'Gardens on White Rock Lake. Go in the morning before the sun is mean.', 'https://www.dallasarboretum.org'),
  v('white-rock', 'White Rock Lake Park', 'Dallas', 'East Dallas', 'outdoors', 0, [M, A, E], 'The lake loop. Bikes, a shoreline, and the Dallas skyline from the east.'),
  v('katy-trail', 'Katy Trail', 'Dallas', 'Uptown', 'outdoors', 0, [M, A, E], 'The rail-trail through Uptown. A walk that ends at ice house hour.'),
  v('trinity-skyline', 'Trinity Skyline Trail', 'Dallas', 'Downtown', 'outdoors', 0, [M, A, E], 'The bridge trail by the Margaret Hunt Hill Bridge. Short, dramatic, free.'),
  v('cedar-ridge', 'Cedar Ridge Preserve', 'Dallas', 'Southwest Dallas', 'outdoors', 0, [M, A], 'Audubon trails in the southwest hills. Real dirt, not a deck park.'),
  v('trinity-audubon', 'Trinity River Audubon Center', 'Dallas', 'Great Trinity Forest', 'outdoors', 8, [M, A], 'Boardwalks in the Great Trinity Forest. A quieter hour than downtown.'),
  v('dallas-zoo', 'Dallas Zoo', 'Dallas', 'Oak Cliff', 'outdoors', 18, [M, A], 'The Oak Cliff zoo. A full morning if the group wants one big outdoor stop.', 'https://www.dallaszoo.com'),

  // Dallas — Gaming
  v('cidercade-dallas', 'Cidercade Dallas', 'Dallas', 'Design District', 'gaming', 15, [A, E, N], 'Free-play arcade in the Design District. One cover, then the group scatters and reconvenes.', 'https://cidercade.com/dallas', true),
  v('pinstack-dallas', 'Pinstack', 'Dallas', 'North Dallas', 'gaming', 24, [A, E, N], 'Bowling, ropes, and arcade under one roof. Built for groups who will not agree.'),
  v('dave-busters-dallas', "Dave & Buster's Dallas", 'Dallas', 'North Dallas', 'gaming', 28, [A, E, N], 'The big arcade and bar. Play, eat, leave before it becomes the whole night.', 'https://www.daveandbusters.com'),
  v('escape-game-dallas', 'The Escape Game Dallas', 'Dallas', 'North Dallas', 'gaming', 36, [A, E, N], 'Escape rooms with a set start time. Book one room for the whole group.', 'https://theescapegame.com'),
  v('main-event-dallas', 'Main Event Dallas', 'Dallas', 'North Dallas', 'gaming', 25, [A, E, N], 'Bowling and arcade if Pinstack is booked. Same idea, different parking lot.'),
  v('nvm', 'National Videogame Museum', 'Dallas', 'Frisco', 'gaming', 12, [A], 'The museum of games in Frisco. An hour, then you are back outside.', 'https://nvmusa.org'),
  v('andretti-colony', 'Andretti Indoor Karting & Games', 'Dallas', 'The Colony', 'gaming', 32, [A, E, N], 'Karts and arcade north of town. A commitment, so make it the main stop.'),
  v('round1-grapevine', 'Round1 Grapevine Mills', 'Dallas', 'Grapevine', 'gaming', 22, [A, E, N], 'Bowling and Japanese arcade cabinets at Grapevine Mills.'),

  // Dallas — Sports
  v('att-stadium', 'AT&T Stadium', 'Dallas', 'Arlington', 'sports', 60, [A, E], 'The Cowboys stadium in Arlington. A tour or a game, not a casual third stop.', 'https://www.dallascowboys.com'),
  v('globe-life', 'Globe Life Field', 'Dallas', 'Arlington', 'sports', 35, [E], 'Rangers baseball under the roof. Pair it with Arlington, not with Uptown.', 'https://www.mlb.com/rangers'),
  v('aac', 'American Airlines Center', 'Dallas', 'Victory Park', 'sports', 40, [E, N], 'Mavericks and Stars. Victory Park dinner before, not a second side of the city after.'),
  v('cotton-bowl', 'Cotton Bowl Stadium', 'Dallas', 'Fair Park', 'sports', 25, [A, E], 'The Fair Park stadium. Game day or the State Fair, otherwise walk the grounds.'),
  v('toyota-stadium', 'Toyota Stadium', 'Dallas', 'Frisco', 'sports', 25, [E], 'FC Dallas in Frisco. A match night, then stay on the north side.'),
  v('topgolf-dallas', 'Topgolf Dallas', 'Dallas', 'Northwest Dallas', 'sports', 30, [A, E, N], 'A bay of balls and nachos. Works when nobody wants a real tee time.'),
  v('stevens-park', 'Stevens Park Golf Course', 'Dallas', 'Oak Cliff', 'sports', 25, [M, A], 'Public golf in Oak Cliff. Nine holes if the calendar is tight.'),
  v('ifly-dallas', 'iFLY Dallas', 'Dallas', 'North Dallas', 'sports', 50, [A, E], 'Indoor skydiving. One flight, then a cheaper second stop.'),

  // Dallas — Nightlife
  v('deep-ellum', 'Deep Ellum', 'Dallas', 'Deep Ellum', 'nightlife', 20, [E, N], 'The district itself: murals, small rooms, and a bar every few doors. Walk it instead of picking a mall.', undefined, true),
  v('midnight-rambler', 'Midnight Rambler', 'Dallas', 'Downtown', 'nightlife', 22, [E, N], 'The cocktail bar in the Joule on Main Street. One excellent drink, then move.'),
  v('katy-ice-house', 'Katy Trail Ice House', 'Dallas', 'Uptown', 'nightlife', 16, [A, E, N], 'The icehouse at the trailhead. The Dallas version of "we will just stay here."', 'https://www.katytrailicehouse.com'),
  v('deb', 'Deep Ellum Brewing Company', 'Dallas', 'Deep Ellum', 'nightlife', 15, [A, E], 'Brewery in Deep Ellum. Start here if the group is still deciding where to walk.'),
  v('community-beer', 'Community Beer Company', 'Dallas', 'Design District', 'nightlife', 14, [A, E], 'Design District taproom. Easy before Cidercade, which is nearby.'),
  v('peticolas', 'Peticolas Brewing Company', 'Dallas', 'Design District', 'nightlife', 14, [A, E], 'Another Design District brewery, smaller and easier to talk in.'),
  v('four-corners', 'Four Corners Brewing Co.', 'Dallas', 'The Cedars', 'nightlife', 14, [A, E], 'Oak Cliff born, now an easy taproom south of downtown.'),
  v('las-almas', 'Las Almas Rotas', 'Dallas', 'Fair Park', 'nightlife', 16, [E, N], 'Mezcal bar by Fair Park. A better night than another Uptown patio.'),
  v('old-monk', 'Old Monk', 'Dallas', 'Knox-Henderson', 'nightlife', 16, [E, N], 'Belgian beer bar on Henderson. Long tables, fries, a second round.'),

  // Dallas — Arts
  v('dma', 'Dallas Museum of Art', 'Dallas', 'Arts District', 'arts', 0, [A], 'Free general admission in the Arts District. An hour, then Klyde Warren is across the street.', 'https://www.dma.org', true),
  v('nasher', 'Nasher Sculpture Center', 'Dallas', 'Arts District', 'arts', 12, [A], 'The sculpture garden and pavilion next to the DMA.', 'https://www.nashersculpturecenter.org'),
  v('perot', 'Perot Museum of Nature and Science', 'Dallas', 'Victory Park', 'arts', 20, [M, A], 'The cube in Victory Park. Kids of all ages, which includes this group.', 'https://www.perotmuseum.org'),
  v('sixth-floor', 'The Sixth Floor Museum at Dealey Plaza', 'Dallas', 'Downtown', 'arts', 20, [A], 'The museum in the old Texas School Book Depository. Heavy, and worth it.', 'https://www.jfk.org'),
  v('meadows', 'Meadows Museum', 'Dallas', 'SMU', 'arts', 12, [A], 'Spanish art on the SMU campus. Quiet and smaller than the DMA.', 'https://meadowsmuseumdallas.org'),
  v('crow', 'Crow Museum of Asian Art', 'Dallas', 'Arts District', 'arts', 0, [A], 'Asian art in the Arts District. Free, and a short companion to the DMA.'),
  v('winspear', 'Winspear Opera House', 'Dallas', 'Arts District', 'arts', 35, [E], 'The opera house on Flora. Go for a performance, not a lobby photo.', 'https://www.dallasopera.org'),
  v('aam-dallas', 'African American Museum of Dallas', 'Dallas', 'Fair Park', 'arts', 0, [A], 'Free museum in Fair Park. Pair it with the Cotton Bowl grounds, not with Frisco.'),
  v('bush-center', 'George W. Bush Presidential Center', 'Dallas', 'SMU', 'arts', 18, [A], 'The presidential library on the SMU edge. A full exhibit hour.'),

  // Dallas — Chill
  v('opening-bell', 'Opening Bell Coffee', 'Dallas', 'The Cedars', 'chill', 8, [M, A, E], 'Coffee in the Cedars, and the room Dallas uses when it wants to stay a while.', undefined, true),
  v('wild-detectives', 'The Wild Detectives', 'Dallas', 'Bishop Arts', 'chill', 10, [A, E], 'Bookstore, coffee, and a backyard in Bishop Arts. The hangout if nobody is hungry yet.'),
  v('emporium-pies', 'Emporium Pies', 'Dallas', 'Bishop Arts', 'chill', 10, [A, E], 'Pie shop on Bishop. A slice is a stop, not a meal, which is why it works.'),
  v('dude-sweet', 'Dude, Sweet Chocolate', 'Dallas', 'Bishop Arts', 'chill', 10, [A], 'Chocolate shop. Ten minutes, a bag for later, back outside.'),
  v('white-rock-coffee', 'White Rock Coffee', 'Dallas', 'East Dallas', 'chill', 8, [M, A], 'East Dallas coffee, useful before a lake loop.'),
  v('ascension', 'Ascension Coffee', 'Dallas', 'Oak Lawn', 'chill', 10, [M, A], 'Oak Lawn coffee shop. A clean start before Uptown.'),
  v('halcyon', 'Halcyon', 'Dallas', 'Knox-Henderson', 'chill', 12, [A, E], 'Coffee that turns into a drink as the day slides. Henderson Avenue.'),
  v('hodd-fellows', 'Oddfellows', 'Dallas', 'Knox-Henderson', 'chill', 16, [M, A], 'Brunch cafe on Knox. Go early or accept the wait.'),
  v('hypnotic', 'Hypnotic Donuts', 'Dallas', 'Deep Ellum', 'chill', 8, [M, A], 'Deep Ellum donuts. A first stop, then Pecan Lodge if the group is still standing.'),
  v('empire-baking', 'Empire Baking Company', 'Dallas', 'Lovers Lane', 'chill', 12, [M, A], 'A Dallas bakery for breakfast pastries before the day gets expensive.', 'https://www.empirebaking.com'),

  // San Antonio — Food
  v('mi-tierra', 'Mi Tierra Cafe y Panaderia', 'San Antonio', 'Market Square', 'food', 18, [M, A, E, N], 'Market Square, open long hours since 1941. The bakery case is the whole mood.', 'https://www.mitierracafe.com', true),
  v('schilos', "Schilo's Delicatessen", 'San Antonio', 'River Walk', 'food', 16, [A], 'German-Texas diner on Commerce, open since 1917. Split pea soup and root beer.'),
  v('casa-rio', 'Casa Rio', 'San Antonio', 'River Walk', 'food', 22, [A, E], 'River Walk tables since 1946. Sit on the water if you can get the patio.'),
  v('guenther-house', 'The Guenther House', 'San Antonio', 'King William', 'food', 14, [M, A], 'Breakfast in the Pioneer Flour Mill house. Biscuits, gravy, and the river a block away.'),
  v('henrys', "Henry's Puffy Tacos", 'San Antonio', 'Broadway', 'food', 14, [A, E], 'Puffy tacos on Broadway. This is the San Antonio order.'),
  v('two-m', '2M Smokehouse', 'San Antonio', 'South Side', 'food', 24, [A], 'South Side barbecue. Worth the drive if brisket is the point of the day.'),
  v('chris-madrids', "Chris Madrid's", 'San Antonio', 'Blanco Road', 'food', 14, [A, E], 'Burgers on Blanco since the 1970s. Tostada burgers, a patio, no pretense.'),
  v('cured', 'Cured', 'San Antonio', 'The Pearl', 'food', 30, [A, E], 'The Pearl dining room in the old brewery. A nicer lunch if the budget allows.'),
  v('la-gloria', 'La Gloria', 'San Antonio', 'The Pearl', 'food', 22, [A, E], 'Pearl patio Mexican food. Easier and louder than Cured, which some groups want.'),
  v('los-barrios', 'Los Barrios', 'San Antonio', 'Blanco Road', 'food', 16, [A, E], 'Blanco Road Tex-Mex since 1979. The puffy taco and the enchiladas.'),

  // San Antonio — Music
  v('majestic', 'Majestic Theatre', 'San Antonio', 'Downtown', 'music', 35, [E], 'The 1929 atmospheric theater on Houston Street. Go when the marquee is lit.', 'https://www.majesticempire.com', true),
  v('aztec', 'Aztec Theatre', 'San Antonio', 'Downtown', 'music', 30, [E, N], 'The downtown Aztec. A show night, then the River Walk is outside.'),
  v('arneson', 'Arneson River Theatre', 'San Antonio', 'La Villita', 'music', 0, [E], 'The outdoor theater on the river, audience on one bank and the stage on the other, since 1939.'),
  v('tobin', 'Tobin Center for the Performing Arts', 'San Antonio', 'Downtown', 'music', 30, [E], 'The river-side hall. Symphony, comedy, or whoever is booked.', 'https://www.tobincenter.org'),
  v('floores', "John T. Floore's Country Store", 'San Antonio', 'Helotes', 'music', 20, [E, N], 'The Helotes dance hall since 1942. A drive, and the right one if the group wants a floor.'),
  v('paper-tiger', 'Paper Tiger', 'San Antonio', 'St. Mary\'s Strip', 'music', 15, [N], 'Rock room on the St. Mary\'s Strip. Small bill, late start.'),
  v('sams-burger', "Sam's Burger Joint", 'San Antonio', 'Tobin Hill', 'music', 15, [E, N], 'Burgers and a back room with bands, by the Pearl.'),
  v('jazz-tx', 'Jazz, TX', 'San Antonio', 'The Pearl', 'music', 22, [E, N], 'Jazz at the Pearl. A seated night, not a bar crawl.'),
  v('lonesome-rose', 'The Lonesome Rose', 'San Antonio', 'Downtown', 'music', 12, [E, N], 'Honky-tonk downtown. Boots optional, the jukebox is not.'),

  // San Antonio — Outdoors
  v('river-walk', 'San Antonio River Walk', 'San Antonio', 'Downtown', 'outdoors', 0, [M, A, E, N], 'The downtown river loop. Walk it. A barge is extra if the group wants to sit.', 'https://www.thesanantonioriverwalk.com', true),
  v('brackenridge', 'Brackenridge Park', 'San Antonio', 'Brackenridge', 'outdoors', 0, [M, A], 'The big park by the zoo and the tea garden. Oaks, water, and room to spread out.'),
  v('japanese-tea-garden', 'Japanese Tea Garden', 'San Antonio', 'Brackenridge', 'outdoors', 0, [M, A], 'The sunken garden in Brackenridge, planted in an old quarry and open since 1919.'),
  v('missions', 'San Antonio Missions', 'San Antonio', 'South Side', 'outdoors', 0, [M, A], 'Mission San José and the Mission Reach. UNESCO sites and a river trail, not a single doorway.', 'https://www.nps.gov/saan'),
  v('sabot', 'San Antonio Botanical Garden', 'San Antonio', 'Southeast', 'outdoors', 14, [M, A], 'Formal gardens and Texas habitats east of downtown. Morning is the kind hour.'),
  v('hemisfair', 'Hemisfair and Yanaguana Garden', 'San Antonio', 'Downtown', 'outdoors', 0, [M, A, E], 'The downtown park from the 1968 fair. Playground, lawn, and the Tower of the Americas above it.'),
  v('hardberger', 'Phil Hardberger Park', 'San Antonio', 'North Central', 'outdoors', 0, [M, A], 'The land bridge over Wurzbach and the trails on either side.'),
  v('sa-zoo', 'San Antonio Zoo', 'San Antonio', 'Brackenridge', 'outdoors', 20, [M, A], 'The zoo inside Brackenridge Park. A morning, then the tea garden is next door.', 'https://www.sazoo.org'),

  // San Antonio — Gaming
  v('dave-busters-rivercenter', "Dave & Buster's Rivercenter", 'San Antonio', 'Downtown', 'gaming', 28, [A, E, N], 'Arcade at the Rivercenter, so the River Walk is the walk between stops.', 'https://www.daveandbusters.com', true),
  v('main-event-sa', 'Main Event San Antonio West', 'San Antonio', 'West Side', 'gaming', 25, [A, E, N], 'Bowling, arcade, and laser tag on the west side.'),
  v('andretti-sa', 'Andretti Indoor Karting & Games', 'San Antonio', 'North Loop 1604', 'gaming', 32, [A, E, N], 'Karts and games on Loop 1604. The noisy option.'),
  v('pinstack-sa', 'Pinstack San Antonio', 'San Antonio', 'NW Loop 410', 'gaming', 24, [A, E, N], 'Bowling and arcade inside Loop 410.'),
  v('round1-sa', 'Round1 San Antonio', 'San Antonio', 'San Pedro', 'gaming', 22, [A, E, N], 'Arcade and bowling on San Pedro. Tickets, rhythm games, a group that will not leave.'),
  v('astro-bowl', 'Astro SuperBowl', 'San Antonio', 'Alamo Heights', 'gaming', 14, [E, N], 'Bowling on Harry Wurzbach. A local lane, not a theme park.'),
  v('oak-hills-bowl', 'Oak Hills Bowling Center', 'San Antonio', 'Callaghan', 'gaming', 12, [E, N], 'Family-run lanes on Callaghan. Cheap, plain, and open.'),
  v('evo-lanes', 'EVO Lanes', 'San Antonio', 'Schertz', 'gaming', 18, [A, E, N], 'Bowling and arcade on I-35 in Schertz, when the group is already on the northeast side.'),

  // San Antonio — Sports
  v('frost-bank-center', 'Frost Bank Center', 'San Antonio', 'East Side', 'sports', 35, [E], 'Spurs nights on the east side. Eat nearby. Do not add a Pearl stop after.', 'https://www.nba.com/spurs', true),
  v('alamodome', 'Alamodome', 'San Antonio', 'Downtown', 'sports', 25, [A, E], 'The downtown dome. Event nights only, and then the River Walk is right there.'),
  v('toyota-field', 'Toyota Field', 'San Antonio', 'North Side', 'sports', 20, [E], 'San Antonio FC. A match is the plan. The rest of the night stays north.'),
  v('wolff-stadium', 'Nelson W. Wolff Stadium', 'San Antonio', 'West Side', 'sports', 15, [E], 'Missions baseball. Cheap tickets and a short game.'),
  v('fiesta-texas', 'Six Flags Fiesta Texas', 'San Antonio', 'Northwest', 'sports', 45, [M, A], 'The northwest theme park. A whole day, so do not pretend it is one stop of three.', 'https://www.sixflags.com/fiestatexas'),
  v('seaworld-sa', 'SeaWorld San Antonio', 'San Antonio', 'Westover Hills', 'sports', 45, [M, A], 'The west-side park. Same rule as Fiesta Texas: it eats the calendar.', 'https://seaworld.com/san-antonio'),
  v('brackenridge-golf', 'Brackenridge Golf Course', 'San Antonio', 'Brackenridge', 'sports', 25, [M, A], 'A historic public course by the park. Nine holes and you are back on Broadway.'),
  v('topgolf-sa', 'Topgolf San Antonio', 'San Antonio', 'North Side', 'sports', 30, [A, E, N], 'A bay on the north side. Use it when the group wants swings without a course.'),

  // San Antonio — Nightlife
  v('esquire', 'The Esquire Tavern', 'San Antonio', 'River Walk', 'nightlife', 16, [A, E, N], 'A River Walk bar since 1933. Long wood bar, the water outside.', 'https://www.esquiretavern-sa.com', true),
  v('menger-bar', 'Menger Hotel Bar', 'San Antonio', 'Alamo Plaza', 'nightlife', 18, [E, N], 'The Roosevelt Bar at the Menger, next to the Alamo. One historic drink.'),
  v('friendly-spot', 'The Friendly Spot', 'San Antonio', 'Southtown', 'nightlife', 14, [A, E], 'Southtown icehouse with a huge patio and dogs. The easy yes.'),
  v('blue-star-brew', 'Blue Star Brewing Company', 'San Antonio', 'King William', 'nightlife', 16, [A, E], 'Brewery at the Blue Star arts complex. Art, then a beer, then the river.'),
  v('freetail', 'Freetail Brewing Co.', 'San Antonio', 'North 1604', 'nightlife', 14, [A, E], 'San Antonio brewery on the north loop. A taproom hour.'),
  v('sternewirth', 'Sternewirth at Hotel Emma', 'San Antonio', 'The Pearl', 'nightlife', 22, [E, N], 'The brewery bar inside Hotel Emma. The dressed-up Pearl stop.'),
  v('tycoon-flats', 'Tycoon Flats', 'San Antonio', 'St. Mary\'s Strip', 'nightlife', 14, [A, E, N], 'Patio bar on the St. Mary\'s Strip. Nachos and a long afternoon.'),
  v('brooklynite', 'The Brooklynite', 'San Antonio', 'Southtown', 'nightlife', 18, [E, N], 'Southtown cocktail bar. Small room, so go before it packs.'),
  v('bonham', 'Bonham Exchange', 'San Antonio', 'Downtown', 'nightlife', 12, [N], 'The downtown dance club in a historic building. Late, loud, and a San Antonio institution.'),

  // San Antonio — Arts
  v('the-alamo', 'The Alamo', 'San Antonio', 'Alamo Plaza', 'arts', 0, [M, A], 'The mission and the plaza. Go early, then walk to the river.', 'https://www.thealamo.org', true),
  v('sama', 'San Antonio Museum of Art', 'San Antonio', 'Museum Reach', 'arts', 15, [A], 'The museum in the old Lone Star Brewery on the Museum Reach.', 'https://www.samuseum.org'),
  v('mcnay', 'McNay Art Museum', 'San Antonio', 'Alamo Heights', 'arts', 15, [A], 'The Spanish Colonial mansion and the modern wing. The courtyard is half the visit.', 'https://www.mcnayart.org'),
  v('witte', 'Witte Museum', 'San Antonio', 'Brackenridge', 'arts', 16, [A], 'Texas history and natural science at the edge of Brackenridge Park.', 'https://www.wittemuseum.org'),
  v('briscoe', 'Briscoe Western Art Museum', 'San Antonio', 'Downtown', 'arts', 12, [A], 'Western art on the river downtown. A short, focused hour.'),
  v('ruby-city', 'Ruby City', 'San Antonio', 'King William', 'arts', 0, [A], 'Contemporary art in the red building by the river. Free, small, and sharp.'),
  v('artpace', 'Artpace', 'San Antonio', 'Downtown', 'arts', 0, [A], 'The artist residency galleries on Main. Free, and you are done in under an hour.'),
  v('blue-star-art', 'Blue Star Contemporary', 'San Antonio', 'Southtown', 'arts', 0, [A], 'Contemporary shows in the Blue Star complex, next to the brewery.'),
  v('governors-palace', "Spanish Governor's Palace", 'San Antonio', 'Downtown', 'arts', 6, [A], 'The colonial house on Plaza de Armas. Fifteen quiet minutes.'),

  // San Antonio — Chill
  v('bakery-lorraine', 'Bakery Lorraine', 'San Antonio', 'The Pearl', 'chill', 12, [M, A], 'Pastries at the Pearl. The morning reason to be on this side of town.', 'https://www.bakerylorraine.com', true),
  v('la-panaderia', 'La Panaderia', 'San Antonio', 'Downtown', 'chill', 10, [M, A], 'Mexican bakery downtown and on Broadway. Conchas, coffee, a bench.'),
  v('merit-coffee', 'Merit Coffee', 'San Antonio', 'Downtown', 'chill', 8, [M, A], 'The San Antonio roaster. A precise cup before the river walk.'),
  v('local-coffee', 'Local Coffee', 'San Antonio', 'Southtown', 'chill', 8, [M, A], 'Neighborhood coffee with several shops. Southtown is the easy one before the Friendly Spot.'),
  v('bird-bakery', 'Bird Bakery', 'San Antonio', 'Alamo Heights', 'chill', 10, [M, A], 'Cakes and coffee on Broadway. A short stop near the McNay side of town.'),
  v('earl-abels', "Earl Abel's", 'San Antonio', 'Austin Highway', 'chill', 14, [M, A, E], 'The classic San Antonio diner. Pancakes or a late piece of pie.'),
  v('jims', "Jim's Restaurant", 'San Antonio', 'North Central', 'chill', 12, [M, A, N], 'The San Antonio diner chain. Open late, booths, no plan required.'),
  v('summer-moon-sa', 'Summer Moon Coffee', 'San Antonio', 'North Central', 'chill', 8, [M, A], 'Oak-roasted coffee. A north-side start before Toyota Field or Hardberger.'),
];

function citySlug(city: string): string {
  return city.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function curatedToActivity(venue: Seed): Activity {
  return {
    id: `curated-${citySlug(venue.city)}-${venue.id}`,
    name: venue.name,
    category: venue.category,
    categoryLabel: CATEGORY_LABELS[venue.category],
    location: `${venue.city}, TX`,
    neighborhood: venue.area,
    estimatedCostPerPerson: venue.cost,
    durationMinutes: venue.minutes ?? MINUTES[venue.category],
    description: venue.blurb,
    highlights: [venue.area, CATEGORY_LABELS[venue.category]],
    rating: 0,
    reviewCount: 0,
    popularTimes: venue.windows.map((part) => WINDOW_TEXT[part]).join(', '),
    bestFor: `A ${venue.city} group stop`,
    tags: [
      'Curated',
      CATEGORY_LABELS[venue.category],
      ...venue.windows.map((part) => `part:${part}`),
      ...(venue.signature ? ['signature'] : []),
    ],
    sourceUrl: venue.url,
    kind: 'place',
    isLiveResult: false,
    uncertainties: [`Curated ${venue.city} venue. Price is a typical per-person estimate.`],
  };
}

const CURATED_ACTIVITIES = VENUES.map(curatedToActivity);

export function curatedVenueCounts(): Record<CuratedCity, Record<ActivityCategory, number>> {
  const counts = {} as Record<CuratedCity, Record<ActivityCategory, number>>;
  for (const venue of VENUES) {
    if (!counts[venue.city]) counts[venue.city] = {} as Record<ActivityCategory, number>;
    counts[venue.city][venue.category] = (counts[venue.city][venue.category] || 0) + 1;
  }
  return counts;
}

export function curatedActivitiesForLocation(location?: string): Activity[] {
  const haystack = (location || '').toLowerCase();
  const cities: CuratedCity[] = ['San Antonio', 'Austin', 'Houston', 'Dallas'];
  const city = cities.find((item) => haystack.includes(item.toLowerCase()));
  if (!city) return [];
  return CURATED_ACTIVITIES.filter((activity) => activity.location.startsWith(city));
}

export function curatedDayParts(activity: { tags?: string[] }): DayPart[] {
  return (activity.tags || []).flatMap((tag) => {
    const match = /^part:(morning|afternoon|evening|night)$/.exec(tag);
    return match ? [match[1] as DayPart] : [];
  });
}
