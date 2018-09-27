#version 150

in vec2 outTexCoord;
in vec3 pixPos;
in vec3 out_Normal;
in vec3 lightPos[4];

uniform int objID;

uniform vec4 diffColor;
uniform float shininess;

uniform sampler2D texUnit;

out vec4 out_Color;


vec4 calculateLighting()
{
	const vec3 light = vec3(0.58, 0.58, 0.58); // Given in VIEW coordinates! You usually specify light sources in world coordinates.
	
    vec3 normal = normalize(out_Normal);

    vec3 lightDir, refl, color = vec3(0.0, 0.0, 0.0);
    float ambient = 0.2, diffuse, specular = 0.0;

    vec3 camDir = normalize(/*camPos*/-pixPos);

    lightDir = normalize(light);

    refl = normalize(-reflect(lightDir, normal));

    diffuse = max(dot(lightDir, normal), 0.0);

    specular = pow( max(dot(refl, camDir), 0.0), 100);

    color = vec3(ambient + 0.6*diffuse + 1.0*specular);

    return vec4(color, 1.0);
}

void main(void)
{
    switch(objID)
    {
        case 0: out_Color = calculateLighting() * diffColor * texture(texUnit, outTexCoord); break;
        case 1: out_Color = calculateLighting() * diffColor; break;
    }
}
