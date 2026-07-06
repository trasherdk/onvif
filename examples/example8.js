// NodeJS ONVIF Library Example
// (c) Roger Hardiman 2021
// MIT License

// OSD - On Screen Display example.

// Delete all existing text based  OSD items (don't delete time/date overlays)
// Add one new OSD item

// Also makes use of Promise API by converting Callback Functions to Promises

//
// There are many differences with cameras.
// Some cameras have a maximm length for the OSD display and will not display anything if the line is too long [eg a Hanwha]
// Some cameras report OSD in different positions but always put the OSD into the lower left [eg a Hik camera]
// Some cameras only support OSD via Media2 (and not Media1)  [eg Bosch]
// Some cameras support OSD but only for adding Date/Time and not general text [eg Bosch Flexidome 4000i]
// Some cameras are buggy and report XML which is not correctly formwatted bit we have to cope with [Chinese XM modules]

import 'dotenv/config';
import { Cam } from '../dist/onvif.js';
import { promisify } from 'util';

const { CAMERA_HOST, USERNAME, PASSWORD, PORT } = process.env;

console.log('Connecting to the camera');

new Cam({
    hostname: CAMERA_HOST,
    username: USERNAME,
    password: PASSWORD,
    port: PORT,
    timeout: 10000,
    preserveAddress: true   // Enables NAT support and re-writes of XAddr where NAT is detected
}, async function CamFunc(err) {
    if (err) {
        console.log(err);
        return;
    }

    console.log('Connected to ONVIF Device');


    // Use Promisify to make promises
    let camObj = this;

    const getDeviceInformationAsync = promisify(camObj.getDeviceInformation).bind(camObj); // being used for logging
    const getOSDOptionsAsync = promisify(camObj.getOSDOptions).bind(camObj);
    const getOSDsAsync = promisify(camObj.getOSDs).bind(camObj);
    const deleteOSDAsync = promisify(camObj.deleteOSD).bind(camObj);
    const createOSDAsync = promisify(camObj.createOSD).bind(camObj);
    const setOSDAsync = promisify(camObj.setOSD).bind(camObj);

    // OSDs are added to a Video Source.
    // Get the 'defaut' Video Source Configuration Token by looking at the Default Media Profile
    let defaultVideoSourceConfigurationToken = camObj.defaultProfile.videoSourceConfiguration.$.token; // or use camObj.activeSource.videoSourceConfigurationToken;

    try {
        ////////////////////////////////////
        // GET DEVICE MAKE/MODEL
        ////////////////////////////////////
        const gotInfo = await getDeviceInformationAsync();
        console.log("Connected to " + JSON.stringify(gotInfo));

        ////////////////////////////////////
        // GET OSD OPTIONS
        ////////////////////////////////////
        let getOptions = {
            videoSourceConfigurationToken: defaultVideoSourceConfigurationToken
        };
        let optionsResult;
        try {
            optionsResult = await getOSDOptionsAsync(getOptions);
        } catch (osdErr) {
            console.log('GetOSDOptions failed:', osdErr.message || osdErr);
            console.log('OSD is not supported on this camera (common on budget Yoosee/Xiongmai IPCs).');
            process.exit(0);
        }
        console.log("Maximum number of OSDs " + JSON.stringify(optionsResult.getOSDOptionsResponse.OSDOptions.maximumNumberOfOSDs.$));


        ////////////////////////////////////
        // GET LIST OF OSDs
        ////////////////////////////////////
        let existingOSDs;
        try {
            existingOSDs = await getOSDsAsync(defaultVideoSourceConfigurationToken);
        } catch (osdErr) {
            console.log('GetOSDs failed:', osdErr.message || osdErr);
            console.log('OSD is not supported on this camera (common on budget Yoosee/Xiongmai IPCs).');
            process.exit(0);
        }

        try {
            console.log("Found " + existingOSDs.getOSDsResponse.OSDs.length + " exising OSDs");
            for (const osd of existingOSDs.getOSDsResponse.OSDs) {

                let msg = osd.type;
                if (osd.type == "Text") msg += osd.textString.type;


                // Only delete items that are Text and that are not of type DateTime
                if (osd.type == "Text" && osd.textString.type != "DateAndTime") {
                    ////////////////////////////////////
                    // DELETE OSDs
                    ////////////////////////////////////
                    console.log("Deleteing OSD Token " + osd.$.token);
                    await deleteOSDAsync(osd.$.token);
                }
                else {
                    console.log("Keeping OSD Token " + osd.$.token);
                }
            }
        } catch { }



        ////////////////////////////////////
        // ADD OSD
        ////////////////////////////////////

        // The OSD can be added to several different positions.
        // Loop through all available positions until we managed to add one
        let positionOptions = optionsResult.getOSDOptionsResponse.OSDOptions.positionOption;
        if (!Array.isArray(positionOptions)) {
            positionOptions = [positionOptions];
        }
        for (const position of positionOptions) {

            let createOptions = {
                videoSourceConfigurationToken: defaultVideoSourceConfigurationToken,
                plaintext: "Hello World",
                position: position
            };

            console.log("Tying to add new OSD to " + position);

            try {
                let createResult = await createOSDAsync(createOptions);
                console.log("New OSD created with token " + createResult.createOSDResponse.OSDToken);
                break; // EXIT the For Loop
            } catch {
                // go back around the for loop
            }
        }

        console.log("Finished");
    } catch (err) {
        console.log('Error:', err.message || err);
        process.exit(1);
    }
})

