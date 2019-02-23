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

vec2 cellular(vec3 P) {
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

    vec3 p = permute(Pi.x + vec3(-1.0, 0.0, 1.0));
    vec3 p1 = permute(p + Pi.y - 1.0);
    vec3 p2 = permute(p + Pi.y);
    vec3 p3 = permute(p + Pi.y + 1.0);

    vec3 p11 = permute(p1 + Pi.z - 1.0);
    vec3 p12 = permute(p1 + Pi.z);
    vec3 p13 = permute(p1 + Pi.z + 1.0);

    vec3 p21 = permute(p2 + Pi.z - 1.0);
    vec3 p22 = permute(p2 + Pi.z);
    vec3 p23 = permute(p2 + Pi.z + 1.0);

    vec3 p31 = permute(p3 + Pi.z - 1.0);
    vec3 p32 = permute(p3 + Pi.z);
    vec3 p33 = permute(p3 + Pi.z + 1.0);

    vec3 ox11 = fract(p11*K) - Ko;
    vec3 oy11 = mod7(floor(p11*K))*K - Ko;
    vec3 oz11 = floor(p11*K2)*Kz - Kzo; // p11 < 289 guaranteed

    vec3 ox12 = fract(p12*K) - Ko;
    vec3 oy12 = mod7(floor(p12*K))*K - Ko;
    vec3 oz12 = floor(p12*K2)*Kz - Kzo;

    vec3 ox13 = fract(p13*K) - Ko;
    vec3 oy13 = mod7(floor(p13*K))*K - Ko;
    vec3 oz13 = floor(p13*K2)*Kz - Kzo;

    vec3 ox21 = fract(p21*K) - Ko;
    vec3 oy21 = mod7(floor(p21*K))*K - Ko;
    vec3 oz21 = floor(p21*K2)*Kz - Kzo;

    vec3 ox22 = fract(p22*K) - Ko;
    vec3 oy22 = mod7(floor(p22*K))*K - Ko;
    vec3 oz22 = floor(p22*K2)*Kz - Kzo;

    vec3 ox23 = fract(p23*K) - Ko;
    vec3 oy23 = mod7(floor(p23*K))*K - Ko;
    vec3 oz23 = floor(p23*K2)*Kz - Kzo;

    vec3 ox31 = fract(p31*K) - Ko;
    vec3 oy31 = mod7(floor(p31*K))*K - Ko;
    vec3 oz31 = floor(p31*K2)*Kz - Kzo;

    vec3 ox32 = fract(p32*K) - Ko;
    vec3 oy32 = mod7(floor(p32*K))*K - Ko;
    vec3 oz32 = floor(p32*K2)*Kz - Kzo;

    vec3 ox33 = fract(p33*K) - Ko;
    vec3 oy33 = mod7(floor(p33*K))*K - Ko;
    vec3 oz33 = floor(p33*K2)*Kz - Kzo;

    vec3 dx11 = Pfx + jitter*ox11;
    vec3 dy11 = Pfy.x + jitter*oy11;
    vec3 dz11 = Pfz.x + jitter*oz11;

    vec3 dx12 = Pfx + jitter*ox12;
    vec3 dy12 = Pfy.x + jitter*oy12;
    vec3 dz12 = Pfz.y + jitter*oz12;

    vec3 dx13 = Pfx + jitter*ox13;
    vec3 dy13 = Pfy.x + jitter*oy13;
    vec3 dz13 = Pfz.z + jitter*oz13;

    vec3 dx21 = Pfx + jitter*ox21;
    vec3 dy21 = Pfy.y + jitter*oy21;
    vec3 dz21 = Pfz.x + jitter*oz21;

    vec3 dx22 = Pfx + jitter*ox22;
    vec3 dy22 = Pfy.y + jitter*oy22;
    vec3 dz22 = Pfz.y + jitter*oz22;

    vec3 dx23 = Pfx + jitter*ox23;
    vec3 dy23 = Pfy.y + jitter*oy23;
    vec3 dz23 = Pfz.z + jitter*oz23;

    vec3 dx31 = Pfx + jitter*ox31;
    vec3 dy31 = Pfy.z + jitter*oy31;
    vec3 dz31 = Pfz.x + jitter*oz31;

    vec3 dx32 = Pfx + jitter*ox32;
    vec3 dy32 = Pfy.z + jitter*oy32;
    vec3 dz32 = Pfz.y + jitter*oz32;

    vec3 dx33 = Pfx + jitter*ox33;
    vec3 dy33 = Pfy.z + jitter*oy33;
    vec3 dz33 = Pfz.z + jitter*oz33;

    vec3 d11 = dx11 * dx11 + dy11 * dy11 + dz11 * dz11;
    vec3 d12 = dx12 * dx12 + dy12 * dy12 + dz12 * dz12;
    vec3 d13 = dx13 * dx13 + dy13 * dy13 + dz13 * dz13;
    vec3 d21 = dx21 * dx21 + dy21 * dy21 + dz21 * dz21;
    vec3 d22 = dx22 * dx22 + dy22 * dy22 + dz22 * dz22;
    vec3 d23 = dx23 * dx23 + dy23 * dy23 + dz23 * dz23;
    vec3 d31 = dx31 * dx31 + dy31 * dy31 + dz31 * dz31;
    vec3 d32 = dx32 * dx32 + dy32 * dy32 + dz32 * dz32;
    vec3 d33 = dx33 * dx33 + dy33 * dy33 + dz33 * dz33;

    // Sort out the two smallest distances (F1, F2)
#if 0
    // Cheat and sort out only F1
    vec3 d1 = min(min(d11,d12), d13);
    vec3 d2 = min(min(d21,d22), d23);
    vec3 d3 = min(min(d31,d32), d33);
    vec3 d = min(min(d1,d2), d3);
    d.x = min(min(d.x,d.y),d.z);
    return vec2(sqrt(d.x)); // F1 duplicated, no F2 computed
#else
    // Do it right and sort out both F1 and F2
    vec3 d1a = min(d11, d12);
    d12 = max(d11, d12);
    d11 = min(d1a, d13); // Smallest now not in d12 or d13
    d13 = max(d1a, d13);
    d12 = min(d12, d13); // 2nd smallest now not in d13
    vec3 d2a = min(d21, d22);
    d22 = max(d21, d22);
    d21 = min(d2a, d23); // Smallest now not in d22 or d23
    d23 = max(d2a, d23);
    d22 = min(d22, d23); // 2nd smallest now not in d23
    vec3 d3a = min(d31, d32);
    d32 = max(d31, d32);
    d31 = min(d3a, d33); // Smallest now not in d32 or d33
    d33 = max(d3a, d33);
    d32 = min(d32, d33); // 2nd smallest now not in d33
    vec3 da = min(d11, d21);
    d21 = max(d11, d21);
    d11 = min(da, d31); // Smallest now in d11
    d31 = max(da, d31); // 2nd smallest now not in d31
    d11.xy = (d11.x < d11.y) ? d11.xy : d11.yx;
    d11.xz = (d11.x < d11.z) ? d11.xz : d11.zx; // d11.x now smallest
    d12 = min(d12, d21); // 2nd smallest now not in d21
    d12 = min(d12, d22); // nor in d22
    d12 = min(d12, d31); // nor in d31
    d12 = min(d12, d32); // nor in d32
    d11.yz = min(d11.yz,d12.xy); // nor in d12.yz
    d11.y = min(d11.y,d12.z); // Only two more to go
    d11.y = min(d11.y,d11.z); // Done! (Phew!)
    return sqrt(d11.xy); // F1, F2
#endif
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
            vec3 dy = Pfy.x + jitter*oy;
            vec3 dz = Pfz.x + jitter*oz;

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
    vec2 dists = cellular(v_position * 10.0);
    float noise_factor = 0.1 + smoothstep(0.1, 0.2, dists.y - dists.x);
    vec3 brown = vec3(0.54, 0.26, 0.1);
    fragColor = vec4(diffuse_factor * noise_factor * brown, 1);
}
