#version 300 es
precision mediump float;

in vec3 v_normal;
in vec3 v_position;
out vec4 fragColor;

#define MM 0

float ofs = 0.;
    
int FAULT = 1;                 // 0: crest 1: fault

float RATIO = 2.,              // stone length/width ratio
    STONE_slope = .3,        // 0.  .3  .3  -.3
    STONE_height = 1.,       // 1.  1.  .6   .7
    profile = 1.,            // z = height + slope * dist ^ prof
    
    CRACK_zebra_scale = 1.5, // fractal shape of the fault zebra
    CRACK_zebra_amp = 1.7,
    CRACK_profile = .2,      // fault vertical shape  1.  .2 
    CRACK_slope = 1.4,       //                      10.  1.4noise2(p+17.7)
    CRACK_width = .0;
    

// std int hash, inspired from https://www.shadertoy.com/view/XlXcW4
vec3 hash3( uvec3 x ) 
{
#   define scramble  x = ( (x>>8U) ^ x.yzx ) * 1103515245U // GLIB-C const
    scramble; scramble; scramble; 
    return vec3(x) / float(0xffffffffU) +1e-30; // <- eps to fix a windows/angle bug
}

// === Voronoi =====================================================
// --- Base Voronoi. inspired by https://www.shadertoy.com/view/MslGD8

#define hash22(p)  fract( 18.5453 * sin( p * mat2(127.1,311.7,269.5,183.3)) )
#define disp(p) ( -ofs + (1.+2.*ofs) * hash22(p) )

vec3 voronoi( vec2 u )  // returns len + id
{
    vec2 iu = floor(u), v;
    float m = 1e9,d;

    for( int k=0; k < 9; k++ ) {
        vec2  p = iu + vec2(k%3-1,k/3-1),
            o = disp(p),
            r = p - u + o;
        d = dot(r,r);
        if( d < m ) m = d, v = r;
    }

    return vec3( sqrt(m), v+u );
}

// --- Voronoi distance to borders. inspired by https://www.shadertoy.com/view/ldl3W8
vec3 voronoiB( vec2 u )  // returns len + id
{
    vec2 iu = floor(u), C, P;
    float m = 1e9,d;
    for( int k=0; k < 9; k++ ) {
        vec2  p = iu + vec2(k%3-1,k/3-1),
            o = disp(p),
            r = p - u + o;
        d = dot(r,r);
        if( d < m ) m = d, C = p-iu, P = r;
    }

    m = 1e9;
    
    for( int k=0; k < 25; k++ ) {
        vec2 p = iu+C + vec2(k%5-2,k/5-2),
            o = disp(p),
            r = p-u + o;

        if( dot(P-r,P-r)>1e-5 )
            m = min( m, .5*dot( (P+r), normalize(r-P) ) );
    }

    return vec3( m, P+u );
}

// === pseudo Perlin noise =============================================
#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
int MOD = 1;  // type of Perlin noise
    
// --- 2D
#define hash21(p) fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123)
float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p); f = f*f*(3.-2.*f); // smoothstep

    float v= mix( mix(hash21(i+vec2(0,0)),hash21(i+vec2(1,0)),f.x),
                  mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x), f.y);
    return   MOD==0 ? v
        : MOD==1 ? 2.*v-1.
        : MOD==2 ? abs(2.*v-1.)
        : 1.-abs(2.*v-1.);
}

float fbm2(vec2 p) {
    float v = 0.,  a = .5;
    mat2 R = rot(.37);

    for (int i = 0; i < 9; i++, p*=2.,a/=2.) 
        p *= R,
            v += a * noise2(p);

    return v;
}
#define noise22(p) vec2(noise2(p),noise2(p+17.7))
vec2 fbm22(vec2 p) {
    vec2 v = vec2(0);
    float a = .5;
    mat2 R = rot(.37);

    for (int i = 0; i < 9; i++, p*=2.,a/=2.) 
        p *= R,
            v += a * noise22(p);

    return v;
}


// --- 3D 
#define hash31(p) fract(sin(dot(p,vec3(127.1,311.7, 74.7)))*43758.5453123)
float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p); f = f*f*(3.-2.*f); // smoothstep

    float v= mix( mix( mix(hash31(i+vec3(0,0,0)),hash31(i+vec3(1,0,0)),f.x),
                       mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x), f.y), 
                  mix( mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),
                       mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x), f.y), f.z);
    return   MOD==0 ? v
        : MOD==1 ? 2.*v-1.
        : MOD==2 ? abs(2.*v-1.)
        : 1.-abs(2.*v-1.);
}

#define noise33(p) vec3(noise3(p),noise3(p+17.7),noise3(p+31.3))
vec3 fbm33(vec3 p) {
    vec3 v = vec3(0.);
    float a = .5;
    mat2 R = rot(.37);

    for (int i = 0; i < 9; i++, p*=2.,a/=2.) 
        p.xy *= R, p.yz *= R,
            v += a * noise33(p);

    return v;
}

vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

// Modulo 7 without a division
vec3 mod7(vec3 x) {
  return x - floor(x * (1.0 / 7.0)) * 7.0;
}

// Modulo 7 without a division
vec4 mod7(vec4 x) {
    return x - floor(x * (1.0 / 7.0)) * 7.0;
}

// Permutation polynomial: (34x^2 + x) mod 289
vec3 permute(vec3 x) {
    return mod289((34.0 * x + 1.0) * x);
}

vec4 permute(vec4 x) {
    return mod289((34.0 * x + 1.0) * x);
}

vec2 worley(vec3 P) {
    const float K = 0.142857142857; // 1/7
    const float Ko = 0.428571428571; // 1/2-K/2
    const float K2 = 0.020408163265306; // 1/(7*7)
    const float Kz = 0.166666666667; // 1/6
    const float Kzo = 0.416666666667; // 1/2-1/6*2
    const float jitter = 1.0; // smaller jitter gives more regular pattern

    vec3 Pi = mod289(floor(P));
    vec3 Pf = fract(P) - 0.5;

    vec3 Pfx = Pf.x + vec3(1.0, 0.0, -1.0);
    vec3 Pfy = Pf.y + vec3(1.0, 0.0, -1.0);
    vec3 Pfz = Pf.z + vec3(1.0, 0.0, -1.0);

    vec3 p_for_x = permute(Pi.x + vec3(-1.0, 0.0, 1.0));

    float first = 9999999.9;
    float second = 9999999.9;

    for (int i = -1; i <= 1; i++) {
        vec3 p_for_y = permute(p_for_x + Pi.y + float(i));

        for (int j = -1; j <= 1; j++) {
            vec3 p_for_z = permute(p_for_y + Pi.z + float(j));

            vec3 ox = fract(p_for_z*K) - Ko;
            vec3 oy = mod7(floor(p_for_z*K))*K - Ko;
            vec3 oz = floor(p_for_z*K2)*Kz - Kzo; // p_for_z < 289 guaranteed

            vec3 dx = Pfx + jitter*ox;
            vec3 dy = Pfy[i + 1] + jitter*oy;
            vec3 dz = Pfz[j + 1] + jitter*oz;

            vec3 d = dx*dx + dy*dy + dz*dz;

            for (int k = 0; k < 3; k++) {
                if (d[k] < first) {
                    second = first;
                    first = d[k];
                } else if (d[k] < second) {
                    second = d[k];
                }
            }
        }
    }

    return vec2(first, second);
}
    
// ======================================================

float mainImage(vec2 U)
{
    //U *= 8./iResolution.y;
    // O = vec4( 1.-voronoiB(U).x,voronoi(U).x, 0,0 );   // for tests
    
    vec2 V =  U / vec2(RATIO,1),                      // voronoi cell shape
        D = fbm22(CRACK_zebra_scale*U) / CRACK_zebra_scale / CRACK_zebra_amp;
    vec3  H = voronoiB( V + D );
    float d = H.x,                                    // distance to cracks
        r = voronoi(V).x,                           // distance to center
        s = STONE_height-STONE_slope*pow(r,profile);// stone interior
    // cracks
    d = min( 1., CRACK_slope * pow(max(0.,d-CRACK_width),CRACK_profile) );
  
    //vec4 O = vec4(vec3(H.x), 1.0);
    /*O = vec4( 
      FAULT==1 ? d * s                              // fault * stone
      : mix(1.,s, d)                       // crest or stone
      );*/
    return d * s;
#if MM
    O.g = hash3(uvec3(H.yz,1)).x;
#endif
}

void main() {
    vec3 lightdir = normalize(vec3(1, 1, 1));
    float diffuse_factor = max(0.2, dot(normalize(v_normal), lightdir));
    //vec2 dists = worley(v_position * 10.0, 0.8, false);
    //float noise_factor = mainImage(v_position.xy + vec2(v_position.z, 0));//(dists.y - dists.x);
    vec2 dists = worley(v_position * 10.0);
    float noise_factor = 0.1 + smoothstep(0.1, 0.2, dists.y - dists.x);
    vec3 brown = vec3(0.54, 0.26, 0.1);
    fragColor = vec4(diffuse_factor * noise_factor * brown, 1);
}
