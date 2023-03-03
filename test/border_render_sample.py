import bpy
import os

cut_into = 2 # 2x2 smaller images
output_folder = "//renders"

rndr = bpy.context.scene.render

rndr.use_border = True
rndr.use_crop_to_border = False

for row in range(cut_into):
  for column in range(cut_into):
    filename = "chunk_{}_{}".format(row, column)
    rndr.filepath = os.path.join(output_folder, filename)
    
    rndr.border_min_x = (1 / cut_into) * row
    rndr.border_max_x = (1 / cut_into) * (row + 1)
    rndr.border_min_y = (1 / cut_into) * column
    rndr.border_max_y = (1 / cut_into) * (column + 1)
    
    bpy.ops.render.render(write_still = True)

# blender -b file.blend -P border_render_sample.py -noaudio