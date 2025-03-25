import InfluencersSchema from '../influencers/InfluencersSchema.js';
import multer from 'multer';
import cloudinary from 'cloudinary';
import _ from 'lodash';
import puppeteer, { Puppeteer } from 'puppeteer';
import OpenAI from "openai";
import dotenv from 'dotenv';
dotenv.config();

const storage = multer.diskStorage({});
const upload = multer({ storage }); 
const hunterIoApiKey = process.env.HUNTER_IO_API_KEY;
const snovIoUserId = process.env.SNOV_USER_ID;
const snovIoSecret = process.env.SNOV_SECRET;
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
const openAiApiKey = process.env.OPENAI_API_KEY;
//Configure Cloudinary
cloudinary.config({
    cloud_name: 'dza3ed8yw',
    api_key: cloudinaryApiKey,
    api_secret: cloudinaryApiSecret
});

// Initialize the OpenAI client with your API key
const openai = new OpenAI({
    apiKey: openAiApiKey, // Replace with your OpenAI API key
});

/*
// Function to fetch emails by domain
const getEmailsByDomain = async (firstName, domain) => {
    // Extract domain from the URL
    const match = domain.match(/:\/\/(?:www\.)?([^/]+)/);
    const domainEmail = match ? match[1] : null;

    if (!domainEmail) return null; // Early return if no valid domain

    const possibleEmail = `${firstName}@${domainEmail}`;

    const url = `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${hunterIoApiKey}`;
    const url2 = `https://api.hunter.io/v2/email-verifier?email=${possibleEmail}&api_key=${hunterIoApiKey}`;

    try {
        // Fetch domain search response
        const response = await fetch(url);

        if (!response.ok) {
            console.error('Error fetching domain search data:', response.status);
            return null;
        }

        const data = await response.json();

        // Check if any emails are found in the domain search
        if (_.isEmpty(data?.data?.emails)) {
            // If no emails, verify the possible email
            const response2 = await fetch(url2);

            if (!response2.ok) {
                console.error('Error verifying email:', response2.status);
                return null;
            }

            return response2.json();
        }

        // Return domain search emails if available
        return data;

    } catch (error) {
        console.error('Error fetching from Hunter.io:', error);
        return null;
    }
};
*/

// Async function to make the request
const isCorrectInfluencerType = async(bio, profileName, category) => {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            store: true,
            messages: [
                { 
                    role: "user", 
                    content: `Can you parse this Instagram influencers account bio "${bio}" and profile name "${profileName}", and tell me if this influencer is 
                    a ${category}. Can you please reply with only an array. If this influencer is a ${category}, please reply with only "true" 
                    as the first element in the array. If this influencer is not a ${category}, please reply with only "false" as the first 
                    element in the array. 
                    
                    Next, if you see any emails listed in their bio, please inject an array with any emails found as the second element
                    in the array you return. if you do not see any emails listed in their bio, please inject an empty array as the second element
                    in the array that you return. So you should only be returning an array with those 2 values inside.`
                },
            ]
        });
        const data = JSON.parse(completion.choices[0].message.content);
        return data;
    } catch (error) {

    }
}

const getInfluencersRealNameLastTry = async(username, bio, bioLink) => {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            store: true,
            messages: [
                { 
                    role: "user", 
                    content: `This instagram influencers account username is "${username}", their bio link is "${bioLink}", and their bio says "${bio}". Judging by their username bio link and bio text, can you detect this instagram influencers first name? Or first and last name if possible. If you are able to detect a name, please reply with only their name. If you are not able to detect a name, please reply with only "null".`
                },
            ],
        });

        return completion.choices[0].message.content;
    } catch (error) {  
        return [];
    }
}

const getInfluencersRealName = async(name, category, username, bio, bioLink) => {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            store: true,
            messages: [
                { 
                    role: "user", 
                    content: `Can you parse this Instagram influencers name from this text "${name}"? This influencer is 
                    a ${category}. The first and last name should be present but sometimes only the first name will be present. 
                    If you can parse their name, please reply with only their name. If a name is not present, please 
                    reply with only "null".` 
                },
            ],
        });

        if(completion.choices[0].message.content === null || completion.choices[0].message.content === 'null') {
            const completion2 = await openai.chat.completions.create({
                model: "gpt-4",
                store: true,
                messages: [
                    { 
                        role: "user", 
                        content: `This instagram influencers account username is "${username}", their bio link is "${bioLink}", and their bio says "${bio}". Judging by their username bio link and bio text, can you detect this instagram influencers first name? Or first and last name if possible. If you are able to detect a name, please reply with only their name. If you are not able to detect a name, please reply with only "null".`
                    },
                ],
            });
            const data = completion2.choices[0].message.content;
            return data;
        }

        const data = completion.choices[0].message.content;
        return data;
    } catch (error) {

    }
}

const isAvatarAPerson = async(url) => {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Replace with the appropriate model, if needed
        messages: [
            { 
                role: "user", 
                content: [
                    { 
                        type: "text", 
                        text: `I have a list of Instagram influencer profiles, and some pages are fake or company-run. I want to filter out fake and company pages.  
                        I have a URL to the influencer's profile picture/avatar: "${url}". Typically, if the profile picture is not of a **real person** or **the influencer themselves**, it’s either a fake page or a company page.  
                        Please analyze the image and determine if the profile picture is of the influencer themselves.  
                        - If the image is of a **real person** or the **influencer themselves**, respond with **"true"**.  
                        - If the image is not of the influencer (e.g., a company logo or stock image), respond with **"false"**.  
                        
                        **Response Format (Strictly return only:**  
                        - **"true"** (if it’s a person/influencer)  
                        - **"false"** (if not a person/influencer)`
                    },
                    {
                        type: "image_url",
                        image_url: { 
                            url: url 
                        }
                    },
                ]
            }
        ],
        max_tokens: 300,
    });

    const data = await JSON.parse(response.choices[0].message.content);
    return data;
  } catch (error) {

  }
}

const scrapeForInfluencersWebsiteDomain = async(links, name, category) => {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            store: true,
            messages: [
                { 
                    role: "user", 
                    content: `Analyze the following array of links:  
                    - **Links:** "${links}"  
                    - **Influencer Name:** "${name}"  
                    - **Category:** "${category}"  
            
                    Identify the **official business website** of the influencer by following these rules:  
                    - Prioritize the **shortest root domain** (e.g., "example.com" over "sub.example.com").  
                    - Ignore subdomains unless no root domain exists.  
                    - If multiple links share the same root domain, return the **simplest, shortest** one (without quotes). 
                    - If no business website is found, return **"null"** (without quotes).  
            
                    **Response Format (Strictly return only 1 link or "null", no extra text):**`
                }
            ]
        });

        return completion.choices[0].message.content;
    } catch (error) {

    }
}

const identifyLinkType = async(link, name, category) => {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            store: true,
            messages: [
                { 
                    role: "user", 
                    content: `Analyze the following link and classify it accordingly:  
                    - **Link:** "${link}"  
                    - **Influencer Name:** "${name}"  
                    - **Category:** "${category}"  
            
                    Determine if the link falls into one of these categories:  
                    - **MINI-SITE** → A multi-link mini-site (e.g., Linktree, Beacons, Tap.bio, etc.).  
                    - **BUSINESS-SITE** → The influencer’s official business website.  
                    - **"null"** → If the link is neither a mini-site nor an official business website.  
            
                    **Response Format (Strictly return only one of the following, no extra text):**  
                    - **MINI-SITE**  
                    - **BUSINESS-SITE**  
                    - **"null"**`
                }
            ]
        });

        return completion.choices[0].message.content;
    } catch (error) {
        
    }
}

const scrapeBioLinkForMoreLinks = async(url) => {
    try {
      return await scrapeLink(url);
  } catch (error) {
    return []
  }
}

const getUsername = async(url) => {
    const urlObj = new URL(url); // Create a URL object
    const parts = urlObj.pathname.split("/").filter(Boolean); // Get path parts
    return parts[0]; // The first non-empty part is the username
}

const testImportFile = async(req, res, next) => {
    const csv = req.body;
    let category = csv.data.category;

    if(category == 'Update DB') {
        await mapVerifiedEmailsToInfluencers(csv.data.data);
    } else {
        const allPossibleEmails = [];

     for(let influencer of csv.data.data) {
      if(!await InfluencersSchema.findOne({usernameIG: influencer.username}) && Number(influencer.followersCount) >= 1000) {

        const isCorrectInfluencerTypeData = await isCorrectInfluencerType(influencer.biography, influencer.fullName, category);
        if (!isCorrectInfluencerTypeData || !Array.isArray(isCorrectInfluencerTypeData) || isCorrectInfluencerTypeData.length < 2) {
            return res.status(400).json({ error: 'Invalid influencer type data' });
        }
        const isCorrectInfluencer = isCorrectInfluencerTypeData[0];

        if(isCorrectInfluencer === true || isCorrectInfluencer  === 'true') {
            const isAvatarAPersonResult = await isAvatarAPerson(influencer.profilePicUrl);
            if(isAvatarAPersonResult === true || isAvatarAPersonResult === 'true') {
                const influencerToAdd = {};
                const emails = [];
                const emailsSeen = [];
                const emailsInBio = isCorrectInfluencerTypeData[1];

                influencerToAdd.category = `${category} Coach`;
                let influencersRealName = await getInfluencersRealName(influencer.fullName, category, influencer.username, influencer.biography, influencer.externalUrl);
                const linkType = influencer.externalUrl ? await identifyLinkType(influencer.externalUrl, influencersRealName, category) : null;
                
                if(linkType !== null && linkType !== 'null') {
                    const bioLinksFound = await scrapeBioLinkForMoreLinks(influencer.externalUrl);
                    
                    if(String(linkType) === 'MINI-SITE') {
                        const getInfuencersWebsiteDomain = await scrapeForInfluencersWebsiteDomain(bioLinksFound, influencersRealName, category);
                        if(getInfuencersWebsiteDomain !== 'null' && getInfuencersWebsiteDomain !== null) {
                            influencerToAdd.domain = String(getInfuencersWebsiteDomain).replace(/^["']|["']$/g, '');
                        }
                    } else if(String(linkType) === 'BUSINESS-SITE') {
                        influencerToAdd.domain = String(influencer.externalUrl).replace(/^["']|["']$/g, '');
                    }
                } else {
                    influencerToAdd.domain = null;
                }

                influencerToAdd.usernameIG = influencer.username;
                influencerToAdd.firstName = influencersRealName.split(' ')[0];
                influencerToAdd.lastName = influencersRealName.split(' ')[1] || null;
                influencerToAdd.profileUrlIG = influencer.inputUrl;
                influencerToAdd.followersIG = formatNumberToSuffix(Number(influencer.followersCount));
                influencerToAdd.followersIGNum = Number(influencer.followersCount); //convertToNumber(String(followersIG)) || 0;

                if (influencerToAdd.domain && influencerToAdd.firstName) {
                    const cleanDomain = String(influencerToAdd.domain).replace(/^["']|["']$/g, ''); // Removes leading/trailing quotes
                    const match = cleanDomain.match(/:\/\/(?:www\.)?([^/]+)/);
                    const domainEmail = match ? match[1] : null;

                    if (domainEmail) {
                        const possibleEmail = `${influencerToAdd.firstName.toLowerCase()}@${domainEmail}`;
                        influencerToAdd.possibleEmails = [possibleEmail];
                        // Check if lastName is present and add more variations
                        if (influencerToAdd.lastName) {
                            const firstNameLower = influencerToAdd.firstName.toLowerCase();
                            const lastNameLower = influencerToAdd.lastName.toLowerCase();

                            // Add variations to the possibleEmails array
                            influencerToAdd.possibleEmails.push(`${firstNameLower}${lastNameLower}@${domainEmail}`);  // firstname + lastname
                            influencerToAdd.possibleEmails.push(`${firstNameLower}.${lastNameLower}@${domainEmail}`);  // firstname.lastName
                            influencerToAdd.possibleEmails.push(`${firstNameLower.charAt(0)}${lastNameLower}@${domainEmail}`);  // first initial + lastname
                        }
                        allPossibleEmails.push(possibleEmail);
                    }

                    if(emailsInBio.length) {
                        emailsInBio.forEach((email) => {
                            if(!emailsSeen.includes(email)) {
                                emails.push(email);
                                emailsSeen.push(email);
                            }
                        });
                    }
                    
                    influencerToAdd.emails = emails;
                    //influencerToAdd.profileUrlFacebook = hunterIoData?.data?.facebook;
                    //influencerToAdd.profileUrlX = hunterIoData?.data?.twitter;
                    //influencerToAdd.profileUrlYoutube = hunterIoData?.data?.youtube;
                    //influencerToAdd.profileUrlLinkedIn = hunterIoData?.data?.linkedin;
                } else {
                    influencerToAdd.emails = [];
                }

                if (influencer.profilePicUrl) {
                    try {
                        const cloudinaryImg = await cloudinary.uploader.upload(influencer.profilePicUrl);
                        influencerToAdd.profilePic = cloudinaryImg;
                    } catch (error) {
                        console.error('Error uploading profile picture:', error);
                    }
                } else {
                    console.log('No profile picture URL provided');
                }

                influencerToAdd.followersTotal = influencerToAdd.followersIG;
                influencerToAdd.followersTotalNum = influencerToAdd.followersIGNum;

                //CALCULATE INFLUENCERS ENGAGEMENT RATE (last 10 posts)
                const latestPost0CommentsCount = Number(influencer['latestPosts/0/commentsCount']) || 0;
                const latestPost0LikesCount = Number(influencer['latestPosts/0/likesCount']) || 0;
                //const latestPost0VideoView = Number(influencer['latestPosts/0/videoViewCount']) || 0;
                const totalPost0 = (latestPost0CommentsCount + latestPost0LikesCount);

                const latestPost1CommentsCount = Number(influencer['latestPosts/1/commentsCount']) || 0;
                const latestPost1LikesCount = Number(influencer['latestPosts/1/likesCount']) || 0;
                //const latestPost1VideoView = Number(influencer['latestPosts/1/videoViewCount']) || 0;
                const totalPost1 = (latestPost1CommentsCount + latestPost1LikesCount);

                const latestPost2CommentsCount = Number(influencer['latestPosts/2/commentsCount']) || 0;
                const latestPost2LikesCount = Number(influencer['latestPosts/2/likesCount']) || 0;
                //const latestPost2VideoView = Number(influencer['latestPosts/2/videoViewCount']) || 0;
                const totalPost2 = (latestPost2CommentsCount + latestPost2LikesCount);

                const latestPost3CommentsCount = Number(influencer['latestPosts/3/commentsCount']) || 0;
                const latestPost3LikesCount = Number(influencer['latestPosts/3/likesCount']) || 0;
                //const latestPost3VideoView = Number(influencer['latestPosts/3/videoViewCount']) || 0;
                const totalPost3 = (latestPost3CommentsCount + latestPost3LikesCount);

                const latestPost4CommentsCount = Number(influencer['latestPosts/4/commentsCount']) || 0;
                const latestPost4LikesCount = Number(influencer['latestPosts/4/likesCount']) || 0;
                //const latestPost4VideoView = Number(influencer['latestPosts/4/videoViewCount']) || 0;
                const totalPost4 = (latestPost4CommentsCount + latestPost4LikesCount);

                const latestPost5CommentsCount = Number(influencer['latestPosts/5/commentsCount']) || 0;
                const latestPost5LikesCount = Number(influencer['latestPosts/5/likesCount']) || 0;
                //const latestPost5VideoView = Number(influencer['latestPosts/5/videoViewCount']) || 0;
                const totalPost5 = (latestPost5CommentsCount + latestPost5LikesCount);

                const latestPost6CommentsCount = Number(influencer['latestPosts/6/commentsCount']) || 0;
                const latestPost6LikesCount = Number(influencer['latestPosts/6/likesCount']) || 0;
                //const latestPost6VideoView = Number(influencer['latestPosts/6/videoViewCount']) || 0;
                const totalPost6 = (latestPost6CommentsCount + latestPost6LikesCount);

                const latestPost7CommentsCount = Number(influencer['latestPosts/7/commentsCount']) || 0;
                const latestPost7LikesCount = Number(influencer['latestPosts/7/likesCount']) || 0;
                //const latestPost7VideoView = Number(influencer['latestPosts/7/videoViewCount']) || 0;
                const totalPost7 = (latestPost7CommentsCount + latestPost7LikesCount);

                const latestPost8CommentsCount = Number(influencer['latestPosts/8/commentsCount']) || 0;
                const latestPost8LikesCount = Number(influencer['latestPosts/8/likesCount']) || 0;
                //const latestPost8VideoView = Number(influencer['latestPosts/8/videoViewCount']) || 0;
                const totalPost8 = (latestPost8CommentsCount + latestPost8LikesCount);

                const latestPost9CommentsCount = Number(influencer['latestPosts/9/commentsCount']) || 0;
                const latestPost9LikesCount = Number(influencer['latestPosts/9/likesCount']) || 0;
                //const latestPost9VideoView = Number(influencer['latestPosts/9/videoViewCount']) || 0;
                const totalPost9 = (latestPost9CommentsCount + latestPost9LikesCount);

                const latestPost10CommentsCount = Number(influencer['latestPosts/10/commentsCount']) || 0;
                const latestPost10LikesCount = Number(influencer['latestPosts/10/likesCount']) || 0;
                //const latestPost10VideoView = Number(influencer['latestPosts/10/videoViewCount']) || 0;
                const totalPost10 = (latestPost10CommentsCount + latestPost10LikesCount);

                const totalEngagement = 
                    (totalPost0 + totalPost1 + totalPost2 + totalPost3 + totalPost4 + totalPost5 +
                     totalPost6 + totalPost7 + totalPost8 + totalPost9 + totalPost10);

                const engagementRate = (totalEngagement / influencerToAdd.followersIGNum) * 100;
                influencerToAdd.engagement = parseFloat(engagementRate.toFixed(1));

                influencerToAdd.platform = influencer.platform;
                influencerToAdd.city = influencer.city;
                influencerToAdd.state = influencer.state;
                influencerToAdd.country = influencer.country;

                influencerToAdd.updatedDate = new Date().toLocaleString();
                if (areAllRowsValid(influencerToAdd)) {
                    try {
                        await InfluencersSchema.create(influencerToAdd);
                    } catch (error) {
                        console.error('Error saving influencer:', error);
                    }
                } else {
                    console.log('Invalid influencer data, skipping save');
                }
            }
        }
      }
     }
        // Return all possible emails to frontend for CSV export
        res.json({ possibleEmails: allPossibleEmails });
    }
}

const mapVerifiedEmailsToInfluencers = async (emails) => {
    for (const email of emails) {
        const snovEmail = email.Email;
        const emailStatus = email['Email status'];
        const influencer = await InfluencersSchema.findOne({ possibleEmails: { $in: [snovEmail] } });

        if (influencer) {
            if (emailStatus == "valid") {
                // 3️⃣ Check if email already exists in the "emails" array
                if (!influencer.emails.includes(snovEmail)) {
                    influencer.emails.push(snovEmail);

                    // 4️⃣ Save the updated document
                    await influencer.save();
                    console.log(`✅ Added verified email ${snovEmail} to ${influencer.usernameIG}`);
                } else {
                    console.log(`⚠️ Email ${snovEmail} already exists for ${influencer.usernameIG}`);
                }
            } else {
                // 5️⃣ Remove the email from the "possibleEmails" array if the status is not valid
                const emailIndex = influencer.possibleEmails.indexOf(snovEmail);
                if (emailIndex > -1) {
                    influencer.possibleEmails.splice(emailIndex, 1);
                    await influencer.save();
                    console.log(`❌ Removed invalid email ${snovEmail} from ${influencer.usernameIG}'s possibleEmails`);
                }
            }
        } else {
            console.log(`❌ No influencer found for email: ${snovEmail}`);
        }
    }
}

const scrapeProfileLinks = async(username) => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // Go to the Instagram profile page
        const profileUrl = `https://www.instagram.com/${username}/`;
        await page.goto(profileUrl, { waitUntil: 'networkidle2' });

        // Wait for the main content to load
        await page.waitForSelector('a');

        // Extract all links on the page
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a'))
            .map(a => a.href)
            .filter(href => !href.includes('instagram.com')); // Exclude Instagram links
        });

        return links;

    } catch (error) {
        return null;
    } finally {
        await browser.close();
    }
}

const formatNumberToSuffix = (num) => {
    if (num < 1000) {
      return num.toString(); // Numbers less than 1000 stay as-is
    }
  
    const suffixes = [
      { value: 1_000_000, symbol: 'M' },    // Million
      { value: 1_000, symbol: 'K' }         // Thousand
    ];
  
    for (const { value, symbol } of suffixes) {
      if (num >= value) {
        return (num / value).toFixed(1).replace(/\.0$/, '') + symbol;
      }
    }
  
    return num.toString(); // Fallback (not likely needed)
}


const convertToNumber = (input) => {
    // Define multipliers for suffixes
    const suffixMultiplier = {
        k: 1000, // Thousand
        m: 1000000, // Million
        b: 1000000000 // Billion
      };
    
      // Convert input to lowercase
      const normalizedInput = _.toLower(input);
    
      // Check for a valid suffix and multiply accordingly
      for (const [suffix, multiplier] of Object.entries(suffixMultiplier)) {
        if (_.endsWith(normalizedInput, suffix)) {
          const numericPart = parseFloat(normalizedInput.replace(suffix, ''));
          return numericPart * multiplier;
        }
      }
    
      // Return the number directly if no suffix is found
      return parseFloat(input);
}

const areAllRowsValid = ((influencer) => {
    if(influencer.firstName && influencer.usernameIG && influencer.profilePic && 
       influencer.followersTotal && influencer.category && influencer.updatedDate) {
        return true;
    }
    return false;

});

const getUsernameFromUrl = ((csv) => {
    const usernames = [];
    for(let influencer of csv) {
        const url = influencer['ACCOUNT_URL'];
        const match = url.match(/instagram\.com\/([^/]+)\/?$/);
        const username = match ? match[1] : null;
        if(username) {
            usernames.push(username);
        }
    }
    return usernames;
});

const updateInfluencersInDB = async(req, res, next) => {
    const request = req;
    const influencers = await InfluencersSchema.find(request.query);
}

const addInfluencersToDB = async(req, res, next) => {
    const request = req;
    const influencersToScrape = [];
    for(let influencer of influencersToScrape) {
        if(this.canAddInfluencer()) { //scrape profile data to see if influencer is a good fit for Distros DB

        }
    }
}

const getUpdatedDataFromApify = async(req, res, next) => {
    /*
    {
        //can only fetch 2173 per transaction
        "usernames": [
            "humansofny"
        ]
    }
    */
}


const scrapeLink = async (url) => {
    let browser;
    try {
        // Launch browser with some options for better performance
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Navigate to the URL and wait until DOM is fully loaded
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Extract all links
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a'))
                .map(a => a.href)
                .filter(href => href); // Filter out null or undefined hrefs
        });

        return links;
    } catch (error) {
        return []; // Return an empty array if an error occurs
    } finally {
        // Ensure the browser is always closed
        if (browser) {
            await browser.close();
        }
    }
};


const canAddInfluencer = async(req, res, next) => {
    
}

export { updateInfluencersInDB, addInfluencersToDB, testImportFile, convertToNumber, formatNumberToSuffix, getUpdatedDataFromApify };