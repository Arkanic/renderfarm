import bpy
import os
import sys

bpy.ops.file.make_paths_relative()

# 0 = directory to render to
# 1 = frame to render
# 2 = split into how many per side?
# 3 = row to render
# 4 = column to render

argv = sys.argv
argv = argv[argv.index("--") + 1:]

scene = bpy.context.scene
rndr = scene.render

rndr.use_border = True # we only want to render a specific portion of the image
rndr.use_crop_to_border = True # crop to region

rndr.filepath = os.path.join(argv[0], "out")
rndr.image_settings.file_format = "PNG"

scene.frame_set(int(argv[1]))

# set boundaries for render
cut_into = int(argv[2])
row = int(argv[3])
column = int(argv[4])

rndr.border_min_x = (1 / cut_into) * row
rndr.border_max_x = (1 / cut_into) * (row + 1)
rndr.border_min_y = (1 / cut_into) * column
rndr.border_max_y = (1 / cut_into) * (column + 1)

bpy.ops.render.render(write_still = True)

# blender -b file.blend -P renderer.py -noaudio -- "//render" 0 2 0 1
#                                                   path      frame
#                                                               cut into how many?
#                                                                 row
#                                                                   column

try:
    os.remove(os.path.join(argv[0], "renderdata")) # let us try to remove the old renderdata
except OSError:
    pass

f = open(os.path.join(argv[0], "renderdata"), "w")
# fps fps_base rx ry rp
f.write("{}\n{}\n{}\n{}\n{}\n".format(rndr.fps, rndr.fps_base, rndr.resolution_x, rndr.resolution_y, rndr.resolution_percentage)) # fps is the frames per second in a render, fps_base is the multiplier
f.close()