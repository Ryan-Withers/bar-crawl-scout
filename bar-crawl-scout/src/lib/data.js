// Static league data + tuning constants for the SPA.
// Pure values and derived maps only — no DOM, no mutable state, no localStorage.
// Data literals are ported verbatim from the pre-SPA app (js/data.js).

export const PLAYERS=[
 [1,"Jahmyr Gibbs","RB","DET",6,1.3,"prime"],[2,"Bijan Robinson","RB","ATL",11,1.7,"prime"],
 [3,"Ja'Marr Chase","WR","CIN",6,3.0,"prime"],[4,"Puka Nacua","WR","LAR",11,4.0,"asc"],
 [5,"Jaxon Smith-Njigba","WR","SEA",11,5.3,"asc"],[6,"Christian McCaffrey","RB","SF",8,6.0,"aging"],
 [7,"Jonathan Taylor","RB","IND",13,7.0,"prime"],[8,"Amon-Ra St. Brown","WR","DET",6,7.7,"prime"],
 [9,"Justin Jefferson","WR","MIN",6,10.0,"prime"],[10,"CeeDee Lamb","WR","DAL",14,11.0,"prime"],
 [11,"James Cook","RB","BUF",7,11.3,"prime"],[12,"Ashton Jeanty","RB","LV",13,12.7,"yr2"],
 [13,"De'Von Achane","RB","MIA",6,14.0,"prime"],[14,"Saquon Barkley","RB","PHI",10,15.0,"aging"],
 [15,"Brock Bowers","TE","LV",13,17.3,"asc"],[16,"Omarion Hampton","RB","LAC",7,17.3,"yr2"],
 [17,"Trey McBride","TE","ARI",14,17.7,"prime"],[18,"Drake London","WR","ATL",11,17.7,"asc"],
 [19,"Chase Brown","RB","CIN",6,18.3,"asc"],[20,"Kenneth Walker III","RB","KC",5,18.7,"prime"],
 [21,"Derrick Henry","RB","BAL",13,21.3,"aging"],[22,"A.J. Brown","WR","NE",11,21.7,"prime"],
 [23,"Nico Collins","WR","HOU",8,22.3,"prime"],[24,"Josh Allen","QB","BUF",7,23.0,"prime"],
 [25,"George Pickens","WR","DAL",14,24.7,"asc"],[26,"Jeremiyah Love","RB","ARI",14,25.3,"rookie"],
 [27,"Chris Olave","WR","NO",8,27.3,"asc"],[28,"Kyren Williams","RB","LAR",11,31.0,"prime"],
 [29,"Rashee Rice","WR","KC",5,31.7,"asc"],[30,"Breece Hall","RB","NYJ",13,32.0,"prime"],
 [31,"DeVonta Smith","WR","PHI",10,32.0,"prime"],[32,"Malik Nabers","WR","NYG",8,33.3,"asc"],
 [33,"Javonte Williams","RB","DAL",14,34.3,"prime"],[34,"Travis Etienne Jr.","RB","NO",8,34.7,"prime"],
 [35,"Colston Loveland","TE","CHI",10,36.3,"yr2"],[36,"Emeka Egbuka","WR","TB",10,38.0,"yr2"],
 [37,"Josh Jacobs","RB","GB",11,38.3,"aging"],[38,"Tee Higgins","WR","CIN",6,38.3,"prime"],
 [39,"Zay Flowers","WR","BAL",13,39.3,"asc"],[40,"Cam Skattebo","RB","NYG",8,40.7,"yr2"],
 [41,"Tetairoa McMillan","WR","CAR",5,42.3,"yr2"],[42,"Garrett Wilson","WR","NYJ",13,42.7,"prime"],
 [43,"Lamar Jackson","QB","BAL",13,44.0,"prime"],[44,"Ladd McConkey","WR","LAC",7,44.0,"asc"],
 [45,"Luther Burden III","WR","CHI",10,46.7,"yr2"],[46,"Quinshon Judkins","RB","CLE",11,47.3,"yr2"],
 [47,"DJ Moore","WR","BUF",7,47.7,"prime"],[48,"Joe Burrow","QB","CIN",6,49.7,"prime"],
 [49,"Tyler Warren","TE","IND",13,51.7,"yr2"],[50,"David Montgomery","RB","HOU",8,52.0,"aging"],
 [51,"TreVeyon Henderson","RB","NE",11,53.7,"yr2"],[52,"Mike Evans","WR","SF",8,54.0,"fading"],
 [53,"Bucky Irving","RB","TB",10,54.3,"asc"],[54,"Terry McLaurin","WR","WAS",7,54.3,"prime"],
 [55,"Davante Adams","WR","LAR",11,54.3,"fading"],[56,"Drake Maye","QB","NE",11,54.7,"asc"],
 [57,"Jameson Williams","WR","DET",6,55.0,"asc"],[58,"D'Andre Swift","RB","CHI",10,55.3,"prime"],
 [59,"Jaylen Waddle","WR","DEN",10,55.7,"prime"],[60,"Jadarian Price","RB","SEA",11,57.7,"yr2"],
 [61,"Jayden Daniels","QB","WAS",7,59.0,"asc"],[62,"Bhayshul Tuten","RB","JAC",7,60.7,"yr2"],
 [63,"Rome Odunze","WR","CHI",10,63.0,"asc"],[64,"Caleb Williams","QB","CHI",10,65.7,"asc"],
 [65,"Christian Watson","WR","GB",11,68.3,"prime"],[66,"Jalen Hurts","QB","PHI",10,68.3,"prime"],
 [67,"Brian Thomas Jr.","WR","JAC",7,69.3,"asc"],[68,"Dak Prescott","QB","DAL",14,71.3,"prime"],
 [69,"Carnell Tate","WR","TEN",9,71.3,"rookie"],[70,"Harold Fannin Jr.","TE","CLE",11,72.3,"yr2"],
 [71,"Tucker Kraft","TE","GB",11,72.7,"asc"],[72,"Chuba Hubbard","RB","CAR",5,73.3,"prime"],
 [73,"Marvin Harrison Jr.","WR","ARI",14,74.3,"asc"],[74,"Rhamondre Stevenson","RB","NE",11,76.3,"prime"],
 [75,"Jordyn Tyson","WR","NO",8,79.3,"rookie"],[76,"Jaylen Warren","RB","PIT",9,79.3,"prime"],
 [77,"Kyle Pitts Sr.","TE","ATL",11,79.7,"prime"],[78,"Parker Washington","WR","JAC",7,80.0,""],
 [79,"RJ Harvey","RB","DEN",10,80.3,"yr2"],[80,"Trevor Lawrence","QB","JAC",7,80.7,"prime"],
 [81,"Sam LaPorta","TE","DET",6,81.3,"asc"],[82,"Justin Herbert","QB","LAC",7,81.3,"prime"],
 [83,"Alec Pierce","WR","IND",13,81.7,""],[84,"Tony Pollard","RB","TEN",9,81.7,"prime"],
 [85,"Courtland Sutton","WR","DEN",10,85.0,"prime"],[86,"DK Metcalf","WR","PIT",9,85.7,"prime"],
 [87,"Jaxson Dart","QB","NYG",8,85.7,"rookie"],[88,"Rico Dowdle","RB","PIT",9,86.0,"prime"],
 [89,"Matthew Stafford","QB","LAR",11,89.3,"fading"],[90,"Kyle Monangai","RB","CHI",10,89.3,"yr2"],
 [91,"Michael Wilson","WR","ARI",14,89.3,""],[92,"Patrick Mahomes II","QB","KC",5,91.7,"prime"],
 [93,"Chris Godwin Jr.","WR","TB",10,91.7,"prime"],[94,"Makai Lemon","WR","PHI",10,92.7,"rookie"],
 [95,"Brock Purdy","QB","SF",8,96.0,"prime"],[96,"George Kittle","TE","SF",8,97.0,"aging"],
 [97,"Jayden Reed","WR","GB",11,100.0,"prime"],[98,"Blake Corum","RB","LAR",11,100.0,"yr2"],
 [99,"J.K. Dobbins","RB","DEN",10,100.3,"prime"],[100,"Bo Nix","QB","DEN",10,100.3,"asc"],
 [101,"Jared Goff","QB","DET",6,102.0,"prime"],[102,"Jakobi Meyers","WR","JAC",7,103.7,"prime"],
 [103,"Kenneth Gainwell","RB","TB",10,104.0,""],[104,"Travis Kelce","TE","KC",5,104.3,"fading"],
 [105,"Jordan Addison","WR","MIN",6,105.0,"prime"],[106,"Quentin Johnston","WR","LAC",7,105.7,"asc"],
 [107,"Michael Pittman Jr.","WR","PIT",9,106.3,"prime"],[108,"Wan'Dale Robinson","WR","TEN",9,107.7,""],
 [109,"Isaiah Likely","TE","NYG",8,108.7,""],[110,"Dalton Kincaid","TE","BUF",7,110.0,"asc"],
 [111,"Ricky Pearsall","WR","SF",8,110.0,"asc"],[112,"Kyler Murray","QB","MIN",6,110.3,"prime"],
 [113,"Josh Downs","WR","IND",13,110.7,"asc"],[114,"Jake Ferguson","TE","DAL",14,111.0,"prime"],
 [115,"Rachaad White","RB","WAS",7,113.0,"prime"],[116,"Jonathon Brooks","RB","CAR",5,113.0,"yr2"],
 [117,"Dallas Goedert","TE","PHI",10,115.0,"fading"],[118,"Xavier Worthy","WR","KC",5,115.3,"yr2"],
 [119,"Jordan Love","QB","GB",11,116.0,"prime"],[120,"Jordan Mason","RB","MIN",6,117.0,"prime"],
 [121,"Tyler Shough","QB","NO",8,117.7,"rookie"],[122,"Mark Andrews","TE","BAL",13,119.0,"fading"],
 [123,"Baker Mayfield","QB","TB",10,119.3,"prime"],[124,"Aaron Jones Sr.","RB","MIN",6,120.0,"aging"],
 [125,"Matthew Golden","WR","GB",11,121.7,"yr2"],[126,"Romeo Doubs","WR","NE",11,123.7,""],
 [127,"KC Concepcion","WR","CLE",11,124.3,"rookie"],[128,"Jacory Croskey-Merritt","RB","WAS",7,124.3,"yr2"],
 [129,"Chris Rodriguez Jr.","RB","JAC",7,130.0,""],[130,"Tyrone Tracy Jr.","RB","NYG",8,131.0,"yr2"],
 [131,"Malik Willis","QB","MIA",6,132.3,""],[132,"Khalil Shakir","WR","BUF",7,133.3,"prime"],
 [133,"Jayden Higgins","WR","HOU",8,135.7,"yr2"],[134,"Sam Darnold","QB","SEA",11,136.0,"prime"],
 [135,"Oronde Gadsden II","TE","LAC",7,139.3,"yr2"],[136,"Chig Okonkwo","TE","WAS",7,139.3,"prime"],
 [137,"Woody Marks","RB","HOU",8,139.7,"yr2"],[138,"Kenyon Sadiq","TE","NYJ",13,140.3,"rookie"],
 [139,"C.J. Stroud","QB","HOU",8,141.3,"asc"],[140,"Juwan Johnson","TE","NO",8,142.0,"prime"],
 [141,"Jalen Coker","WR","CAR",5,142.0,"yr2"],[142,"Cam Ward","QB","TEN",9,142.7,"yr2"],
 [143,"Rashid Shaheed","WR","SEA",11,144.0,"prime"],[144,"Hunter Henry","TE","NE",11,144.0,"aging"],
 [145,"Stefon Diggs","WR","FA",0,144.3,"fading"],[146,"Isiah Pacheco","RB","DET",6,145.0,"aging"],
 [147,"Brenton Strange","TE","JAC",7,147.7,"asc"],[148,"T.J. Hockenson","TE","MIN",6,148.7,"prime"],
 [149,"Daniel Jones","QB","IND",13,149.0,"prime"],[150,"Keaton Mitchell","RB","LAC",7,149.3,""],
 [151,"Zach Charbonnet","RB","SEA",11,151.3,"prime"],[152,"Jonah Coleman","RB","DEN",10,152.0,"rookie"],
 [153,"Tyler Allgeier","RB","ARI",14,152.3,"prime"],[154,"Jauan Jennings","WR","MIN",6,154.0,"prime"],
 [155,"Omar Cooper Jr.","WR","NYJ",13,155.0,"rookie"],[156,"Bryce Young","QB","CAR",5,155.0,"asc"],
 [157,"Jalen McMillan","WR","TB",10,155.3,"yr2"],[158,"Tyjae Spears","RB","TEN",9,157.7,"prime"],
 [159,"Jalen Nailor","WR","LV",13,158.7,""],[160,"Alvin Kamara","RB","NO",8,161.7,"fading"],
 [161,"Brian Robinson Jr.","RB","ATL",11,166.7,"prime"],[162,"Denzel Boston","WR","CLE",11,167.3,"rookie"],
 [163,"Dylan Sampson","RB","CLE",11,167.3,"yr2"],[164,"Dalton Schultz","TE","HOU",8,167.3,"prime"],
 [165,"Aaron Rodgers","QB","PIT",9,169.7,"fading"],[166,"Antonio Williams","WR","WAS",7,170.7,"yr2"],
 [167,"Jacoby Brissett","QB","ARI",14,172.0,""],[168,"Fernando Mendoza","QB","LV",13,172.7,"rookie"],
 [169,"Tre Tucker","WR","LV",13,173.0,"asc"],[170,"Nicholas Singleton","RB","TEN",9,173.7,"rookie"],
 [171,"Deebo Samuel Sr.","WR","FA",0,176.3,"aging"],[172,"Tank Bigsby","RB","PHI",10,177.0,"prime"],
 [173,"Geno Smith","QB","NYJ",13,177.7,"aging"],[174,"Jerry Jeudy","WR","CLE",11,178.0,"prime"],
 [175,"Tyreek Hill","WR","FA",0,178.7,"aging"],[176,"Gunnar Helm","TE","TEN",9,178.7,"yr2"],
 [177,"David Njoku","TE","LAC",7,179.0,"prime"],[178,"AJ Barner","TE","SEA",11,180.0,"asc"],
 [179,"Emmett Johnson","RB","KC",5,181.0,"rookie"],[180,"Calvin Ridley","WR","TEN",9,181.3,"aging"],
 [181,"Sean Tucker","RB","TB",10,182.7,""],[182,"Mike Washington Jr.","RB","LV",13,184.0,"rookie"],
 [183,"Brandon Aiyuk","WR","SF",8,184.7,"prime"],[184,"Isaac TeSlaa","WR","DET",6,185.3,"yr2"],
 [185,"Cade Otton","TE","TB",10,186.0,"prime"],[186,"Emanuel Wilson","RB","SEA",11,188.0,""],
 [187,"Malik Washington","WR","MIA",6,189.0,"yr2"],[188,"Eli Stowers","TE","PHI",10,190.7,"rookie"],
 [189,"Kaytron Allen","RB","WAS",7,191.3,"rookie"],[190,"Zachariah Branch","WR","ATL",11,192.7,"rookie"],
 [191,"Greg Dulcich","TE","MIA",6,193.0,""],[192,"Pat Freiermuth","TE","PIT",9,193.3,"prime"],
 [193,"Ryan Flournoy","WR","DAL",14,195.3,"yr2"],[194,"De'Zhaun Stribling","WR","SF",8,195.7,"rookie"],
 [195,"Tua Tagovailoa","QB","ATL",11,197.3,"prime"],[196,"Braelon Allen","RB","NYJ",13,197.3,"yr2"],
 [197,"Germie Bernard","WR","PIT",9,199.0,"rookie"],[198,"Kayshon Boutte","WR","NE",11,200.3,"asc"],
 [199,"Tre' Harris","WR","LAC",7,202.0,"yr2"],[200,"Travis Hunter","WR","JAC",7,177.0,"yr2"]
];
export const BYUNAME={};PLAYERS.forEach(p=>BYUNAME[p[1].toLowerCase()]=p);
export const KEPT2025=new Set(["Jahmyr Gibbs","Saquon Barkley","Garrett Wilson","Rashee Rice","Chuba Hubbard","Breece Hall","Brian Thomas Jr.","Christian McCaffrey","Bijan Robinson","Ja'Marr Chase","Malik Nabers","Jaxon Smith-Njigba","Puka Nacua","De'Von Achane","Nico Collins","Josh Jacobs","James Cook","Justin Jefferson","Trey McBride","Xavier Worthy","Stefon Diggs","Marvin Harrison Jr.","Amon-Ra St. Brown","Tyreek Hill","Tee Higgins","Jonathan Taylor","Chase Brown","Drake London","Kyren Williams","CeeDee Lamb"]);
export const TEAMS=[["Ryan","Big Tettys on Bo-nly fans (YOU)"],["joshleota","Buckle Up!"],["WinzTheBrah","Jet2 Hall-iday"],["JohnnyDuff","Go Shough Yourself"],["jduddy9","Nice like Rice"],["jpdonners","WHO DO U THINK LAMAR I AM"],["ATorelli4","Griddler on the roof"],["JShrimp341","Shakir and Baker Baby"],["ShaydenB","Bourne to win"],["ImyHunter","Egbukakke"]];
export const PROJ={
 Ryan:[["Tetairoa McMillan","VL"],["Ja'Marr Chase","VL"],["Brock Bowers","VL"],["",""]],
 joshleota:[["Jahmyr Gibbs","VL"],["Puka Nacua","VL"],["Drake London","VL"],["Justin Jefferson","U"]],
 WinzTheBrah:[["James Cook","VL"],["Breece Hall","VL"],["A.J. Brown","L"],["Garrett Wilson","U"]],
 JohnnyDuff:[["Ashton Jeanty","VL"],["De'Von Achane","VL"],["Jaxon Smith-Njigba","VL"],["Trey McBride","U"]],
 jduddy9:[["Omarion Hampton","VL"],["Christian McCaffrey","VL"],["Rashee Rice","L"],["Derrick Henry","U"]],
 jpdonners:[["CeeDee Lamb","VL"],["Josh Jacobs","VL"],["Travis Etienne Jr.","L"],["Jordan Addison","U"]],
 ATorelli4:[["Amon-Ra St. Brown","VL"],["TreVeyon Henderson","VL"],["Kenneth Walker III","L"],["Drake Maye","U"]],
 JShrimp341:[["Saquon Barkley","VL"],["Chase Brown","VL"],["Kyren Williams","VL"],["Tyler Warren","U"]],
 ShaydenB:[["Jonathan Taylor","VL"],["Nico Collins","VL"],["Quinshon Judkins","L"],["DeVonta Smith","U"]],
 ImyHunter:[["Bijan Robinson","VL"],["Malik Nabers","VL"],["Emeka Egbuka","L"],["Cam Skattebo","U"]]
};
// [2026 multiplier, 2027 multiplier] on the ADP talent base.
// The 2027 column has to price the player he BECOMES, not the label he wears
// now: a 2026 rookie is a 2027 second-year player, and rookie -> sophomore is
// the steepest step on this curve. It previously read 1.10 — BELOW yr2 (1.20)
// and asc (1.15) — which said a first-year player gains less into 2027 than an
// established riser does. Backwards, and it's the reason rookies sank on a
// future board instead of leading it. He also climbs off a 0.70-discounted
// 2026 base, so the step out has to be bigger than yr2's to land in the same
// place. This is the dial to turn if you want rookies pushed harder still.
export const STAGE={rookie:[0.70,1.28],yr2:[1.00,1.20],asc:[1.00,1.15],prime:[1.00,0.90],aging:[1.00,0.70],fading:[0.85,0.45],"":[1.00,0.90]};

// POSITIONAL AGE CURVES — how fast a career phase actually moves, by position.
// The stage tags above are position-blind: "prime" meant [1.00, 1.00] whether
// you were a 27-year-old back or a 26-year-old receiver, so 89% of the board
// (and 53 of 61 RBs) lost NOTHING across the two-year keeper window. Nobody is
// flat across a year, and backs are not receivers.
//
// DECAY multiplies the LOSS a declining stage takes (loss = 1 - stage[1]).
// Backs take it in full; receivers about half; tight ends a little less; and a
// quarterback ages so slowly he keeps most of what an "aging" tag would strip.
// Tuned so the SEVERE end stays severe for everyone: at QB 0.30 a "fading"
// quarterback still held 98% into 2027, which reads as immortality rather than
// as a slow curve. Old quarterbacks stay startable; they don't stay forever.
export const POS_DECAY={RB:1.00,WR:0.62,TE:0.55,QB:0.45};

// DEV multiplies the GAIN a developing stage makes (gain = stage[1] - 1).
// The mirror image: backs arrive closest to finished so they have the least
// left to add, receivers famously take a year or two, tight ends longest.
export const POS_DEV={RB:0.80,WR:1.10,TE:1.20,QB:1.00};

// And the same asymmetry in year ONE: a rookie back is the most plug-and-play
// player in football, a rookie receiver the least. Multiplies the year-one
// rookie discount, clamped below 1 — no rookie is ever a free bet.
export const POS_ROOKIE_Y1={RB:1.10,WR:0.97,TE:0.90,QB:0.94};
export const REPLACEMENT=52;
export const MODES={winnow:[1.0,0.15],balanced:[1.0,1.0],future:[0.4,1.0]};
export const MODEHINT={winnow:"2026 is everything, 2027 only a tiebreak. The final-year studs (Chase, Gibbs, Bijan) rise to the top. A 100-and-gone beats a 55-that-stays here.",balanced:"Both seasons equal. Two-year risers (Jeanty, Bowers) win. A 55-that-stays can beat a 100-and-gone.",future:"2027 dominant, 2026 at 40%. Final-year players crater. This is how the rebuilders see the board."};
export const PTS_BASE={QB:[395,0.974],RB:[322,0.957],WR:[300,0.962],TE:[232,0.93]};
export const POSRANK={};
(function(){const by={};PLAYERS.forEach(p=>{(by[p[2]]=by[p[2]]||[]).push(p);});for(const k in by){by[k].sort((a,b)=>a[5]-b[5]).forEach((p,i)=>POSRANK[p[1]]=i+1);}})();
// 2027 PROJECTED-POINTS growth. Same correction as STAGE's 2027 column and for
// the same reason — a rookie's second year is his biggest jump, so he can't
// grow slower (1.12) than the second-year players (1.16) he's about to join.
export const GROWTH={rookie:1.22,yr2:1.16,asc:1.10,prime:0.97,aging:0.80,fading:0.58,"":0.95};
export const CAPITAL={Ryan:[2,0,3],joshleota:[0,0,1],WinzTheBrah:[1,1,1],JohnnyDuff:[0,0,0],jduddy9:[1,0,0],jpdonners:[0,0,0],ATorelli4:[2,3,1],JShrimp341:[0,1,0],ShaydenB:[2,2,2],ImyHunter:[2,3,2]};
export const FIRSTROUND=[["ImyHunter",""],["Ryan","JShrimp slot"],["ShaydenB",""],["Ryan","own"],["ATorelli4",""],["ImyHunter","jpdonners slot"],["WinzTheBrah",""],["ShaydenB","joshleota slot"],["ATorelli4","Duff slot"],["jduddy9",""]];
export const NEED_TGT={QB:1,RB:3,WR:3,TE:1};
export const FAAB_HIST={ImyHunter:50,jduddy9:36,Ryan:22,jpdonners:11,joshleota:5,JohnnyDuff:5,JShrimp341:2,ShaydenB:3,WinzTheBrah:0,ATorelli4:0};
export const ROSTER2025={1:"Ryan",2:"joshleota",3:"ImyHunter",4:"JohnnyDuff",5:"JShrimp341",6:"jduddy9",7:"WinzTheBrah",8:"ATorelli4",9:"ShaydenB",10:"jpdonners"};
export const STAGE_FAAB={rookie:1.04,yr2:1.05,asc:1.05,prime:1.0,aging:0.92,fading:0.80,"":0.95};
export const LEAN={Ryan:{RB:0,WR:1},joshleota:{RB:1,WR:1},WinzTheBrah:{WR:1,QB:1},JohnnyDuff:{RB:1,QB:1},jduddy9:{RB:2},jpdonners:{RB:1,QB:1},ATorelli4:{RB:1,WR:1},JShrimp341:{RB:1,WR:1},ShaydenB:{RB:1,WR:1,QB:1},ImyHunter:{RB:1,WR:1}};
export const REBUILD=new Set(["ImyHunter","ShaydenB","ATorelli4"]);
export const CONTEND=new Set(["joshleota","jduddy9","WinzTheBrah","JohnnyDuff"]);
export const MGRS=[
 {h:"joshleota",rec:"11-4",pf:"2,032 PF",tags:["Win-now All-In","FAAB Max"],tend:"Win-now contender who trades picks for proven studs and spends FAAB hard. Real pick-by-pick history loads on Sync.",note:"2025 points leader who moved his early 2026 capital out, so he is all-in on this year. Your prime buyer if you sell."},
 {h:"WinzTheBrah",rec:"11-4",pf:"1,856 PF",tags:["Efficient","Frugal FAAB"],tend:"Efficient contender who is hard to fleece and keeps his picks intact. Real draft history loads on Sync.",note:"Won 11 games without spending much FAAB. Disciplined, picks intact."},
 {h:"JohnnyDuff",rec:"10-5",pf:"1,879 PF",tags:["Pick Seller","QB Lean"],tend:"Best-available drafter who has dealt away his early 2026 capital. Real pick history loads on Sync.",note:"Now pick-light after selling 2026 capital. A friendly trade partner on picks."},
 {h:"jduddy9",rec:"9-6",pf:"1,942 PF",tags:["RB Lean","FAAB Max"],tend:"Aggressive contender who clears running backs and spends his full FAAB. Real pick history loads on Sync.",note:"Finished red hot and holds a 2026 first. Spends every FAAB dollar."},
 {h:"jpdonners",rec:"8-7",pf:"1,790 PF",tags:["Big Seller","QB Early"],tend:"Takes a quarterback early then stockpiles passers and depth. Real pick history loads on Sync.",note:"Fully stripped of early 2026 picks. Will deal almost anything."},
 {h:"ATorelli4",rec:"7-8",pf:"1,795 PF",tags:["Pick Accumulator","Wildcard"],tend:"Balanced accumulator of picks and bodies with no strong positional tunnel. Real pick history loads on Sync.",note:"Pick-rich rebuilder holding extra firsts and seconds. Known bluffer on his stated keepers."},
 {h:"Ryan",rec:"5-10",pf:"1,811 PF",tags:["Redacted"],tend:"CLASSIFIED.",note:"CLASSIFIED."},
 {h:"JShrimp341",rec:"5-10",pf:"1,696 PF",tags:["Seller","RB Lean"],tend:"Running-back leaning when he drafts fresh, then fills receiver. Real pick history loads on Sync.",note:"Sold his 2026 first and third to Ryan, so he is pick-light. A seller you can keep buying from."},
 {h:"ShaydenB",rec:"5-10",pf:"1,765 PF",tags:["Aggressive Rebuilder"],tend:"Aggressive rebuilder who drafts balanced and swings on youth. Real pick history loads on Sync.",note:"Bought up a big 2026 war chest (two firsts, two seconds, two thirds). Dark-horse riser."},
 {h:"ImyHunter",rec:"4-11",pf:"1,551 PF",tags:["Rebuilder via Picks","FAAB Max"],tend:"Targets elite running backs when he holds capital, otherwise hoards youth and picks. Real pick history loads on Sync.",note:"Biggest war chest in the league and an all-in rebuild. Top FAAB spender."}
];
export const NAMEOF={};TEAMS.forEach(t=>NAMEOF[t[0]]=t[1]);
export const TEAMSHORT={};TEAMS.forEach(t=>TEAMSHORT[t[0]]=t[1].replace(" (YOU)",""));
export const PICKVAL={2026:{1:150,2:95,3:70,4:50,5:38,6:28,7:20,8:14,9:10,10:8},2027:{1:120,2:76,3:56,4:40,5:30,6:22,7:16}};
export const MYPICKS=[["2026",1],["2026",1],["2026",3],["2026",3],["2026",3]];

// UI config carried over from the render layer.
export const RYAN = "Ryan";
export const TAGS=[{k:"star",l:"Superstar",c:"#f4b23e"},{k:"target",l:"Target",c:"#4fb286"},{k:"sleeper",l:"Sleeper",c:"#5aa0e0"},{k:"value",l:"Value",c:"#a98fd6"},{k:"injury",l:"Injury Prone",c:"#e0613f"},{k:"avoid",l:"Avoid",c:"#9a3618"}];
export const TAGTXT={yr2:["t-riser","Riser"],asc:["t-riser","Asc"],prime:["t-prime","Prime"],aging:["t-winnow","Win-now"],fading:["t-winnow","Fade 27"],rookie:["t-rookie","Rookie"]};
