#version 300 es
precision highp float;
// KEX ribbons: translucent twisted ribbons with fine strands, drawn from traced key curves (design-spec §9, tuned against iteration3).
// Reference frame: the hero at 1339x253. All curve coordinates are in that frame (x right, y down) and stretch with the canvas.
uniform vec2 uRes; uniform float uTime; uniform vec2 uPointer; uniform float uIntensity; uniform float uLeftFade; uniform float uSeed;
// Window of the reference frame shown on the canvas: (x0, y0, x1, y1). Hero: (0,0,1339,253).
uniform vec4 uWin;
// School theme (src/lib/school.ts). Defaults are the identity: body (0,0,1), accent (1,0,0), hi (0,1,0), shape (1,1,1,1), sharp 0.
uniform vec3 uBody; uniform vec3 uAccent; uniform vec3 uHi; uniform vec4 uShape; uniform float uSharp;
out vec4 o;

#define NP 24
const vec2 CA[NP] = vec2[NP](vec2(590.,270.),vec2(610.,250.),vec2(635.,222.),vec2(660.,190.),vec2(700.,150.),vec2(730.,124.),vec2(755.,103.),vec2(800.,55.),vec2(850.,27.),vec2(900.,15.),vec2(950.,17.),vec2(1000.,27.),vec2(1050.,40.),vec2(1091.,52.),vec2(1130.,72.),vec2(1160.,100.),vec2(1190.,135.),vec2(1225.,163.),vec2(1270.,183.),vec2(1310.,195.),vec2(1339.,198.),vec2(1400.,200.),vec2(1500.,200.),vec2(1600.,200.));
const vec2 CB[NP] = vec2[NP](vec2(500.,200.),vec2(560.,185.),vec2(610.,165.),vec2(660.,142.),vec2(710.,120.),vec2(755.,107.),vec2(790.,100.),vec2(820.,97.),vec2(860.,102.),vec2(910.,120.),vec2(950.,145.),vec2(1000.,175.),vec2(1040.,200.),vec2(1090.,220.),vec2(1140.,235.),vec2(1200.,242.),vec2(1250.,237.),vec2(1300.,225.),vec2(1339.,207.),vec2(1400.,185.),vec2(1500.,170.),vec2(1600.,170.),vec2(1700.,170.),vec2(1800.,170.));
const vec2 CC[NP] = vec2[NP](vec2(640.,300.),vec2(680.,270.),vec2(710.,245.),vec2(760.,210.),vec2(810.,185.),vec2(860.,167.),vec2(900.,160.),vec2(940.,163.),vec2(975.,170.),vec2(1000.,176.),vec2(1020.,150.),vec2(1040.,118.),vec2(1065.,80.),vec2(1085.,58.),vec2(1100.,48.),vec2(1125.,28.),vec2(1150.,5.),vec2(1175.,-15.),vec2(1250.,-40.),vec2(1350.,-50.),vec2(1450.,-50.),vec2(1550.,-50.),vec2(1650.,-50.),vec2(1750.,-50.));
const vec2 CP[NP] = vec2[NP](vec2(700.,10.),vec2(800.,20.),vec2(900.,30.),vec2(1000.,40.),vec2(1050.,46.),vec2(1091.,52.),vec2(1120.,57.),vec2(1150.,62.),vec2(1175.,68.),vec2(1200.,76.),vec2(1225.,84.),vec2(1250.,92.),vec2(1275.,98.),vec2(1300.,103.),vec2(1339.,107.),vec2(1380.,108.),vec2(1420.,108.),vec2(1460.,108.),vec2(1500.,108.),vec2(1540.,108.),vec2(1580.,108.),vec2(1620.,108.),vec2(1660.,108.),vec2(1700.,108.));

// Tunables (fitted against iteration3 with scripts/fit-ribbons.mjs).
const float K_HAZE_A = 0.3235, K_HAZE_B = 0.1542, K_HAZE_C = 0.1433;
const float K_FILL_RA = 0.7658, K_FILL_RB = 0.7366, K_FILL_RC = 0.0920, K_FILL_R4 = 0.0955, K_FILL_RB2 = 0.0637, K_FILL_RF = 0.0700, K_FILL_R0 = 0.2588;
const float K_STRAND = 1.0000, K_WHITE = 0.1433;
const float K_RIM_HAIR = 0.5306, K_RIM_HALO = 1.7046, K_HOT = 2.5877, K_GRID = 0.0111;
const float K_GAIN = 1.1500, K_GLOW = 0.9401;

const vec3 Q_RA_TL = vec3(0.7809,0.6429,1.2709), Q_RA_TR = vec3(0.7809,0.3613,1.2636), Q_RA_BL = vec3(0.2827,0.2585,1.2109), Q_RA_BR = vec3(0.7327,0.0664,0.8827);
const vec3 Q_RB_TL = vec3(0.7909,0.7109,1.2809), Q_RB_TR = vec3(1.0136,0.2827,1.2809), Q_RB_B = vec3(0.8751,0.0939,0.9627);
const vec3 Q_RC_T = vec3(0.9673,0.0064,0.5237), Q_RC_B = vec3(0.3593,0.0000,0.5573);
const vec3 Q_R4_T = vec3(0.5691,0.0000,0.5691), Q_R4_B = vec3(0.0491,0.3373,1.1209);
const vec3 Q_RB2_T = vec3(0.0491,0.0000,0.5191), Q_RB2_B = vec3(0.0000,0.0000,0.2191);
const vec3 Q_RF_T = vec3(0.3113,0.0440,0.6191), Q_RF_B = vec3(0.5191,0.0000,0.5691);
const vec3 Q_R0_T = vec3(0.5209,0.4209,1.1309), Q_R0_B = vec3(0.2212,0.1280,0.5673);
const vec3 Q_RIM_L = vec3(1.2309,0.9627,1.3309), Q_RIM_R = vec3(1.0141,0.1364,0.5971), Q_RIM_2 = vec3(1.0627,0.8027,1.3021), Q_RIM_3 = vec3(1.0173,0.3752,0.9173), Q_RIM_3B = vec3(0.2191,0.0691,0.6671), Q_RIM_6 = vec3(0.4891,0.5371,0.9827), Q_RIM_S = vec3(1.3136,0.5691,1.1888);
const vec3 Q_HAZE_A = vec3(0.0325,0.0173,0.5365), Q_HAZE_B = vec3(0.1571,0.0000,0.7973), Q_HAZE_C = vec3(0.3691,0.0000,0.2691);

const vec3 BG0=vec3(.145,.078,.263), BG1=vec3(.114,.071,.220), BG2=vec3(.165,.067,.325);

float curve(const vec2 p[NP], float x){
  int i=0;
  for(int k=0;k<NP-1;k++){ if(x>=p[k+1].x) i=k+1; }
  i=min(i,NP-2);
  vec2 p0=p[max(i-1,0)], p1=p[i], p2=p[i+1], p3=p[min(i+2,NP-1)];
  float h=max(p2.x-p1.x,1e-3); float t=clamp((x-p1.x)/h,0.,1.);
  float m1=(p2.y-p0.y)/max(p2.x-p0.x,1e-3)*h, m2=(p3.y-p1.y)/max(p3.x-p1.x,1e-3)*h;
  float t2=t*t,t3=t2*t;
  return (2.*t3-3.*t2+1.)*p1.y+(t3-2.*t2+t)*m1+(-2.*t3+3.*t2)*p2.y+(t3-t2)*m2;
}

// Curve with the school's shape: vertical scale about y=110 and a horizontal stretch about x=1000 (identity for the default).
float cv(const vec2 p[NP], float x){
  return 110.+(curve(p,1000.+(x-1000.)/uShape.y)-110.)*uShape.x;
}

float tri(float x){ return abs(fract(x)-.5)*4.-1.; }

float g(float d,float w){return exp(-d*d/(w*w));}

// One ribbon between two curves: translucent fill plus hairline strands. Returns the color to add.
vec3 ribbon(float X,float Y,float yt,float yb,float xa,float xb,vec3 cTop,vec3 cBot,float fillA,float strandA,float n,float px){
  float w=yb-yt;
  float fa=xa<720.?150.:30.;
  float mx=smoothstep(xa,xa+fa,X)*(1.-smoothstep(xb-30.,xb,X));
  float dt=(Y-yt)/px, db=(yb-Y)/px;
  float inside=smoothstep(-.6,.6,dt)*smoothstep(-.6,.6,db)*step(.0,w);
  float v=clamp((Y-yt)/max(w,.5),0.,1.);
  vec3 col=mix(cTop,cBot,smoothstep(0.,1.,v));
  float f=v*n; float fw=max(fwidth(f),1e-4);
  float ld=min(fract(f),1.-fract(f))/fw;
  float line=(1.-smoothstep(.15,.95,ld))*smoothstep(1.4,3.2,1./fw);
  float body=fillA*(.55+.45*sin(3.14159*v));
  return inside*mx*(col*body+mix(col,vec3(1.),K_WHITE)*line*strandA*K_STRAND);
}

vec3 rim(float X,float Y,float yc,float xa,float xb,vec3 c,float hair,float halo,float px){
  float d=abs(Y-yc)/px;
  float mx=smoothstep(xa,xa+25.,X)*(1.-smoothstep(xb-25.,xb,X));
  return c*mx*(K_RIM_HAIR*hair*g(d,.85)+K_RIM_HALO*(halo*g(d,7.)+halo*.4*g(d,26.)));
}

void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float X=mix(uWin.x,uWin.z,uv.x);
  float Y=mix(uWin.y,uWin.w,1.-uv.y);
  float px=max((uWin.w-uWin.y)/uRes.y,(uWin.z-uWin.x)/uRes.x);
  float t=uTime*.07*uShape.w+uSeed;

  // gentle drift of the curves
  float dy=3.2*sin(X*.0068+t*3.1)+1.8*sin(X*.0141-t*2.3)+uPointer.y*3.;
  float dy2=3.0*sin(X*.0057+t*2.6+1.7)+1.6*sin(X*.0123-t*2.9+.4)+uPointer.y*4.;
  float dy3=3.4*sin(X*.0075+t*2.2+3.1)+1.5*sin(X*.0160-t*3.3+2.2)+uPointer.y*2.;
  // The school's drift amplitude and its sharp, angular turns (a triangle wave instead of a sine).
  dy*=uShape.z; dy2*=uShape.z; dy3*=uShape.z;
  dy+=uSharp*tri(X*.0042+t*1.3); dy2+=uSharp*tri(X*.0038-t*1.1+.3); dy3+=uSharp*tri(X*.0046+t*.9+.6);
  float yA=cv(CA,X)+dy, yB=cv(CB,X)+dy2, yC=cv(CC,X)+dy3, yP=cv(CP,X)+dy*.7;

  // base: dark violet field, brighter toward the upper right
  vec3 col=mix(mix(BG0,BG1,smoothstep(0.,.45,uv.x)),BG2,smoothstep(.55,1.,uv.x));
  vec3 haze=vec3(0.);
  haze+=Q_HAZE_A*g(length(vec2((X-1260.)/430.,(Y-30.)/150.)),1.)*K_HAZE_A;
  haze+=Q_HAZE_B*g(length(vec2((X-860.)/230.,(Y-190.)/120.)),1.)*K_HAZE_B;
  haze+=Q_HAZE_C*g(length(vec2((X-1060.)/170.,(Y-110.)/95.)),1.)*K_HAZE_C;
  col+=haze;

  // faint grid
  vec2 gp=vec2(X-676.,Y-40.);
  vec2 gd=abs(fract(gp/65.+.5)-.5)*65./px;
  col+=vec3(.5,.35,.9)*K_GRID*(g(gd.x,.9)+g(gd.y,.9))*smoothstep(560.,900.,X);

  vec3 glow=vec3(0.);
  float CROSSX=1091.;
  float aTop=min(yA,yB), aBot=max(yA,yB);
  // RA: lavender-blue ribbon between the big arch and the second arch (they cross at x=755)
  glow+=ribbon(X,Y,aTop,aBot,600.,1030.,mix(Q_RA_TL,Q_RA_TR,smoothstep(760.,1000.,X)),mix(Q_RA_BL,Q_RA_BR,smoothstep(760.,1000.,X)),K_FILL_RA,.7,56.,px);
  // RB: pink lens between the second arch and the pink rim, pinching at x=1000
  glow+=ribbon(X,Y,yB,yC,700.,1000.,mix(Q_RB_TL,Q_RB_TR,smoothstep(700.,1000.,X)),Q_RB_B,K_FILL_RB,.8,60.,px);
  // RC: pink strands under the pink rim down to the hero bottom
  glow+=ribbon(X,Y,yC,yC+170.,680.,1000.,Q_RC_T,Q_RC_B,K_FILL_RC,.8,46.,px);
  // RE: from the arch down to the rising pink rim, up to the crossing
  glow+=ribbon(X,Y,yA,yC,1000.,CROSSX+10.,mix(Q_RA_TR,Q_RB_TR,.3),mix(Q_RA_BR,Q_RB_B,.7),K_FILL_RA*.9,.8,50.,px);
  // R4: dark lens between the pink rim on the right and the steep white rim
  glow+=ribbon(X,Y,yP,yA,CROSSX,1360.,Q_R4_T,Q_R4_B,K_FILL_R4,.7,44.,px);
  // RB2: dark purple field under the steep rim, down to the lower sweep
  glow+=ribbon(X,Y,yA,yB,CROSSX,1360.,Q_RB2_T,Q_RB2_B,K_FILL_RB2,.5,40.,px);
  // RF: top right fan above the pink rim
  glow+=ribbon(X,Y,max(yC,-30.),yP,CROSSX,1360.,Q_RF_T,Q_RF_B,K_FILL_RF,.6,50.,px);
  // R0: faint strands on the left
  glow+=ribbon(X,Y,yB,yB+170.,560.,760.,Q_R0_T,Q_R0_B,K_FILL_R0,.5,40.,px);

  // bright rims
  float hot=1.+K_HOT*(2.2*g(length(vec2((X-1091.)/80.,(Y-52.)/48.)),1.)+1.2*g(length(vec2((X-905.)/70.,(Y-18.)/30.)),1.)+1.4*g(length(vec2((X-1000.)/60.,(Y-176.)/36.)),1.));
  vec3 rimA=mix(Q_RIM_L,Q_RIM_R,smoothstep(980.,1091.,X));
  glow+=rim(X,Y,yA,600.,CROSSX,rimA*hot,.75,.22,px);
  glow+=rim(X,Y,yA,CROSSX,1339.,Q_RIM_6*hot,.75,.22,px);
  glow+=rim(X,Y,yB,560.,1000.,Q_RIM_2*hot,.7,.2,px);
  glow+=rim(X,Y,yB,1000.,1339.,mix(Q_RIM_6,Q_RIM_3B,smoothstep(1090.,1300.,X))*hot,.6,.15,px);
  glow+=rim(X,Y,yC,700.,1160.,Q_RIM_3*hot,.75,.26,px);
  glow+=rim(X,Y,yP,CROSSX,1339.,mix(Q_RIM_S,Q_RIM_R,smoothstep(1091.,1200.,X))*hot,.8,.3,px);

  glow+=vec3(.88,.77,.91)*smoothstep(.9,2.2,dot(glow,vec3(.333)))*.5;
  col+=glow*K_GLOW*smoothstep(uLeftFade-.04,uLeftFade+.20,uv.x)*uIntensity;
  // School palette: the blue channel carries the body of the ribbons, red the highlights, green the white.
  col=col.r*uAccent+col.g*uHi+col.b*uBody;
  o=vec4(1.-exp(-col*K_GAIN),1.);
}
