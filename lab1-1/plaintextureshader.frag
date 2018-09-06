#version 150

in vec2 outTexCoord;
uniform sampler2D texUnit;
uniform float texSize;
out vec4 out_Color;

void main(void)
{
    float offset = 1.0 / texSize;
    vec4 center = texture(texUnit, texCoord);
    vec4 left = texture(texUnit, texCoord + vec2(offset, 0.0));
    vec4 right = texture(texUnit, texCoord + vec2(-offset, 0.0));

    out_Color = texture(texUnit, outTexCoord);
}
