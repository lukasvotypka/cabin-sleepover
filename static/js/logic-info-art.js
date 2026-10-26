// Pure page logic, part 7: the pixel art of „Pred cestou“ as data (palette and sprite grids). No DOM access.
// A sprite is rows of equal length; each character is a PAL key and "." is transparent. The names of
// INFO_ICONS (app/models.py) all have a sprite here; batoh, mesiac and tekvica are used by the page only.

var PAL = { k:'#2B1D14', w:'#FBF6EC', s:'#F2C9A0', g:'#2F7D6D', G:'#1F5A4E', o:'#D07A2B', O:'#A85A1A',
  r:'#A04848', b:'#3E6FB0', B:'#2A4E80', c:'#9FD3F0', y:'#FFD54A', n:'#8A6A4A', N:'#5C4033',
  e:'#C9CED2', E:'#6F767B', p:'#6D5BA8', l:'#5E8A2E', L:'#3F5A2A', m:'#E8D2A6', M:'#FBF1D0' };
var INFO_SPRITES = {
  karimatka:['............','............','..kkkkkkkk..','.kllllllllk.','kllkkllllllk','klkllkllllLk','klkllkllllLk','kllkkllllllk','.kllllllllk.','..kkkkkkkk..','............','............'],
  mesiac:['..MMM.','.MM...','MM....','MM....','.MM...','..MMM.'],
  spacak:['...kkkkkk...','..kggggggk..','..kgssssgk..','..kgskskgk..','..kgssssgk..','..kggggggk..','..kgGggGgk..','..kggggggk..','..kgGggGgk..','..kggggggk..','..kggggggk..','...kkkkkk...'],
  vankus:['............','............','.kkkkkkkkkk.','kwwwwwwwwwwk','kwmwwwwwwmwk','kwwwwwwwwwwk','kwwwwwwwwwwk','kwmwwwwwwmwk','kwwwwwwwwwwk','.kkkkkkkkkk.','............','............'],
  plachta:['............','............','kkkkkkkkkkkk','kcwcwcwcwcwk','kwcwcwcwcwck','kcwcwcwcwcwk','kkkkkkkkkkkk','kmmmmmmmmmmk','kmmmmmmmmmmk','kkkkkkkkkkkk','............','............'],
  papuce:['............','............','............','..kkk..kkk..','.krrrk.krrrk','.kwwrk.kwwrk','.krrrk.krrrk','.krrrk.krrrk','.krrrk.krrrk','.kkkkk.kkkkk','............','............'],
  mikina:['............','...kkkkkk...','.kkooOOookk.','kooooooooook','kokooooookok','kokooooookok','kokOOOOOOkok','kokooooookok','kkkooooookkk','..kooooook..','..kOOOOOOk..','..kkkkkkkk..'],
  uterak:['............','............','..kkkkkkkk..','..kbbbbbbk..','..kcccccck..','..kbbbbbbk..','..kkkkkkkk..','..kppppppk..','..kwwwwwwk..','..kppppppk..','..kkkkkkkk..','............'],
  celovka:['............','..........y.','.........y..','.kkkkkkkk...','kEEEEEEEkyyy','kEeEEEEEkyyy','kEEEEEEEkyyy','.kkkkkkkk...','.........y..','..........y.','............','............'],
  hygiena:['............','....kkkk....','...k....k...','.kkkkkkkkkk.','kppppppppppk','kEEEEEEEEEEk','kppppppppppk','kpppwwwppppk','kppppppppppk','kppppppppppk','.kkkkkkkkkk.','............'],
  topanky:['............','............','..kkkk......','..knnk......','..knnk......','..knnk......','..knnkkkk...','..knnnnnnk..','..knnnnnnnk.','..kNNNNNNNk.','..kkkkkkkkk.','............'],
  stuple:['............','..kkk.......','.kwyok......','.kyyok..kkk.','.kyyok.kwyok','.kyyok.kyyok','.kyyok.kyyok','.kyyok.kyyok','..kkk..kyyok','.......kyyok','........kkk.','............'],
  lieky:['............','....kkkk....','....k..k....','.kkkkkkkkkk.','kwwwwwwwwwwk','kwwwwrrwwwwk','kwwwwrrwwwwk','kwwrrrrrrwwk','kwwrrrrrrwwk','kwwwwrrwwwwk','kwwwwrrwwwwk','.kkkkkkkkkk.'],
  nabijacka:['....kkkk....','..kkkkkkkk..','..kEEEEEEk..','..kEllllEk..','..kEllllEk..','..kEEEEEEk..','..kEllllEk..','..kEllllEk..','..kEEEEEEk..','..kEllllEk..','..kEEEEEEk..','..kkkkkkkk..'],
  flasa:['....kkkk....','....kbbk....','...kkkkkk...','..kcccccck..','..kcwcccck..','..kcwcccck..','..kbbbbbbk..','..kbwwwwbk..','..kbbbbbbk..','..kcccccck..','..kcccccck..','...kkkkkk...'],
  lampion:['.....k......','.....k......','...kkkkk....','..kyyyyyk...','.kyoyyyoyk..','.kyyyyyyyk..','.kyoyyyoyk..','.kyyyyyyyk..','..kyyyyyk...','...kkkkk....','....kkk.....','............'],
  lopta:['............','....kkkk....','..kkwwwwkk..','..kwwkkwwk..','.kwwkrrkwwk.','.kwkrrrrkwk.','.kwkrrrrkwk.','.kwwkrrkwwk.','..kwwkkwwk..','..kkwwwwkk..','....kkkk....','............'],
  lezenie:['......k.....','......k.....','...kkkkkk...','..kEEEyEEk..','.kEEyEEEEEk.','.kEEEEErEEk.','kEErEEEEEEEk','kEEEEEyEEEEk','kEyEEEEEErEk','kEEEEEEEEEEk','kkkkkkkkkkkk','............'],
  tekvica:['.....kk.....','.....kLk....','..kkkkLkkk..','.kooOoooOok.','kooOooooOook','kokkOooOkkok','kooOooooOook','kooOkkkkOook','kooOkookOook','.kooOoooOok.','..kkkkkkkk..','............'],
  truhla:['............','............','..kkkkkkkk..','.knnnnnnnnk.','.kNNNNNNNNk.','.kkkkyykkkk.','.knnnyynnnk.','.knnnnnnnnk.','.knnnnnnnnk.','.kkkkkkkkkk.','............','............'],
  kocka:['............','..kkkkkkkk..','..kwwwwwwk..','..kwkwwkwk..','..kwwwwwwk..','..kwwkkwwk..','..kwwwwwwk..','..kwkwwkwk..','..kwwwwwwk..','..kkkkkkkk..','............','............'],
  smerovnik:['............','.kkkkkkkk...','.knnnnnnnk..','.knmmmmmnnk.','.knnnnnnnk..','.kkkkNkkk...','....kNk.....','....kNk.....','....kNk.....','....kNk.....','...kkkkk....','............'],
  ohen:['............','.....y......','....yy..y...','...yoy..yy..','...yooy.yoy.','..yoroooyoy.','..yorrrooy..','...orrrroy..','....orroo...','..nnNnnNnn..','.nNnnnnnnNn.','..k......k..'],
  hrniec:['............','............','.kkkkkkkkkk.','kEEEEEEEEEEk','.kEEEEEEEEk.','kkEeEEEEEEkk','.kEEEEEEEEk.','.kEEEEEEEEk.','.kEEEEEEEEk.','..kkkkkkkk..','............','............'],
  batoh:['.....kkkkkk.....','....kOOOOOOk....','....kOkkkkOk....','..kkkkkkkkkkkk..','.kooooooooooook.','.kooooooooooook.','.kOOOOOOOOOOOOk.','.koooookkoooook.','.koooookyoooook.','.koooookkoooook.','.kooooooooooook.','.kokkkkkkkkkkok.','.kokOOOOOOOOkok.','.kokOOOOOOOOkok.','.kokkkkkkkkkkok.','..kkkkkkkkkkkk..']
};
INFO_SPRITES.bunda = INFO_SPRITES.mikina;
var INFO_SPRITE_OVERRIDES = { bunda: { o: "#3E6FB0", O: "#2A4E80" } };

// The rects of a sprite at scale s, runs of one color merged: [{x, y, w, h, fill}], relative to (0, 0).
function spriteRects(name, s, over) {
  var rows = INFO_SPRITES[name], out = [];
  if (!rows) return out;
  var colors = over || INFO_SPRITE_OVERRIDES[name] || {};
  rows.forEach(function (row, j) {
    var i = 0;
    while (i < row.length) {
      var ch = row.charAt(i), n = 1;
      while (row.charAt(i + n) === ch) n++;
      if (ch !== ".") out.push({ x: i * s, y: j * s, w: n * s, h: s, fill: colors[ch] || PAL[ch] });
      i += n;
    }
  });
  return out;
}
