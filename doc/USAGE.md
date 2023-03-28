# Usage

## Server

### Server Task

It may be advisable to use something like systemctl to keep the server online constantly in the background, so that if the server shuts down the server will automatically boot again. That being said, the server should be a dedicated machine that IS NOT EXPOSED to the wider internet. Keeping the server online while you are using the server for something else is not advised.

#### Ports

`2254` Is the api endpoint for both the dashboard and the workers. The workers use this to communicate with the server. The dashboard also uses this to get its information.

`8080` Is the statically hosted web interface. The api calls from the interface are made to :2254, whereas :8080 statically hosts all the files.

### Web Interface

The web interface is the interface for uploading blender projects, viewing the server status, and downloading the finished render files. It can be accessed by visiting `http://<the ip of the server>:8080/`.

#### Home Page

![home page](./img/home-page.png)

The home page will show all projects that are currently rendering in a list, and the storage consumed by it. On each item, rendered or unrendered, there is the option to delete it. Some things are of note here:

- Deleting an unrendered project will delete exactly the same, however all the progress made on the render will be lost.
- Deleting a finished project (once you have downloaded the finished render or zip file) is considered standard practise, as the project would otherwise be filling up storage on the render server.

Once a project has finished rendering, it will appear greyed out. Once the finished project has finished compositing - stitching the finished frames together, two links will appear on the project.

![home page with a finished project](./img/home-finished.png)

- "Finished Result" contains a direct link to the image file (if it is a single frame being rendered) or an mp4 video (if a video is being rendered)
- "Raw Frames" contains a direct link to a .zip file containing all of the image "chunks" (directly rendered by the workers) that have not been stitched together in any way. The frames follow the format of `<project id>-<frame number>-<row rendered>-<column rendered>.<image format>`. The purpose of this is for people who have very specific image requirements that might get mangled by the compositor stitching the frames together. For normal use you won't need this file.

#### Upload Page

This page lets you upload a project to the renderfarm to be rendered.

##### Creating a zip file for the renderfarm

Projects are uploaded as a .zip file because it is the best way to preserve the assets and file structures of a render. If only .blend files were uploaded, it would be impossible to render the scene if the file used external files like textures and multiple imported blend objects.

###### Building projects for the renderfarm

For all the blend files in your project, open them and go `File > External Data > Make All Paths Relative`. Then save the file. This setting changes how blender stores the pathnames for external assets. For example, a file that is stored in "C:/Users/Bob/Documents/blender/textues/funny.png" will now be stored as "./textures/funny.png". The purpose of this is to make the blender file not relevant to the system it is being rendered on, as the prior path is only valid for the one machine it was created on.

You should make sure your blender project has a folder structure where all the textures are in child folders to the blender file. This means that your folder structure should look something like the following:

```
monkey-project
    |
    __ monkey.blend
    __ assets
        |
        __ fur_16k.hdr
        __ tree.png
        __ background_16k.hdr
    __ files
        |
        __ ape.blend
```

You don't have to order your project exactly like this, but the purpose is to illustrate how you should have all your files in once place so that the parent folder (in this case `monkey-project`) can be zipped neatly without any unrelated files. If you had a project that looked something like the following:

```
blender
    |
    __ textures
        |
        __ texture-for-monkey.png
        __ completely-unrelated-12gb-file.zip
    __ blend
        |
        __ monkey.blend
        __ other-project.blend
```

it cannot be neatly zipped without including other unrelated files which will bloat the zip file.

Zip the folder for upload. On windows this can be achieved by Right Click > Send To > Compressed (Zipped) Folder. Make sure that all the assets needed will be inside the zip file.

Visit the renderfarm dashboard and click "upload". You should see the following screen:

![dashboard upload page](./img/upload-page.png)

Click on the button to upload your zipped blender file (with all assets), and click next. You will now see this page:

![dashboard upload configuration](./img/upload-picture.png)

- **Blender file to be rendered**: This is a dropdown menu that shows all of the .blend files in your zip folder. Select the blend file that is your main project.
- **Title**: This is just to be able to clearly tell which project is which on the dashboard
- **Animation**: This checkbox 