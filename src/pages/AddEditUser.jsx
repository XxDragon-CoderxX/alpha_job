import React, { useState, useEffect } from 'react';
import { Button, Form, Grid, Loader } from "semantic-ui-react";
import { storage, db } from "../firebase";
import { useParams, useNavigate } from "react-router-dom";
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Magicpen } from 'iconsax-react';


const initialState = {
  name: "",
  email: "",
  info: "",
  contact: "",
  latitude: "",
  longitude: "",
  businessType: "",
  industrySector: "",
  website: "",
  organizationSize: "",
  availability: "",
  additionalNotes: "",
  tags: "",
};

const AddEditUser = () => {
  const [data, setData] = useState(initialState);
  const { name, email, info, contact, latitude, longitude, businessType, industrySector, website, organizationSize, availability, additionalNotes, tags } = data;
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmit, setIsSubmit] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    if (id) {
      getSingleUser();
    }
  }, [id]);

  const getSingleUser = async () => {
    const docRef = doc(db, "users", id);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      setData({ ...snapshot.data(), latitude: snapshot.data().latitude.toString(), longitude: snapshot.data().longitude.toString() });
    }
  };

  useEffect(() => {
    const uploadFile = () => {
      const name = new Date().getTime() + file.name;
      const storageRef = ref(storage, file.name);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on("state_changed", (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(progress);
      }, (error) => {
        console.log(error);
      }, () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          setData((prev) => ({ ...prev, img: downloadURL }));
        });
      });
    };

    file && uploadFile();
  }, [file]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setData({ ...data, [name]: value });
    validateField(name, value);
  };

  const validateField = (fieldName, value) => {
    let error = null;

    switch (fieldName) {
      case 'name':
        if (!value) error = 'Name is required';
        break;
      case 'email':
        if (!value) error = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(value)) error = 'Email is invalid';
        break;
      case 'info':
        if (!value) error = 'Info is required';
        break;
      case 'contact':
        if (!value) error = 'Contact is required';
        break;
      case 'latitude':
        if (!value) error = 'Latitude is required';
        else if (isNaN(value)) error = 'Latitude must be a number';
        break;
      case 'longitude':
        if (!value) error = 'Longitude is required';
        else if (isNaN(value)) error = 'Longitude must be a number';
        break;
      case 'businessType':
        if (!value) error = 'Business Type is required';
        break;
      case 'industrySector':
        if (!value) error = 'Industry/Sector is required';
        break;
      case 'website':
        if (!value) error = 'Website is required';
        else if (!isValidURL(value)) error = 'Website URL is invalid';
        break;
      case 'organizationSize':
        if (!value) error = 'Organization Size is required';
        break;
      case 'availability':
        if (!value) error = 'Availability is required';
        break;
      case 'additionalNotes':
        if (!value) error = 'Additional Notes/Description is required';
        break;
      case 'tags':
        if (!value) error = 'Tags are required';
        break;
      default:
        break;
    }

    setErrors((prevErrors) => ({
      ...prevErrors,
      [fieldName]: error,
    }));
  };

  const isValidURL = (url) => {
    const pattern = new RegExp('^(https?:\\/\\/)?' +
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' +
      '((\\d{1,3}\\.){3}\\d{1,3}))' +
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' +
      '(\\?[;&a-z\\d%_.~+=-]*)?' +
      '(\\#[-a-z\\d_]*)?$', 'i');
    return !!pattern.test(url);
  };

  const validate = () => {
    let valid = true;
    const newErrors = {};

    Object.keys(data).forEach((fieldName) => {
      validateField(fieldName, data[fieldName]);
      if (errors[fieldName]) {
        valid = false;
        newErrors[fieldName] = errors[fieldName];
      }
    });

    setErrors(newErrors);
    return valid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validate()) {
      setIsSubmit(true);
      try {
        const userData = {
          ...data,
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          timestamp: serverTimestamp()
        };

        if (!id) {
          await addDoc(collection(db, "users"), userData);
        } else {
          const docRef = doc(db, "users", id);
          await updateDoc(docRef, userData);
        }

        navigate("/");
      } catch (error) {
        console.error("Error adding/updating document: ", error);
      } finally {
        setIsSubmit(false);
      }
    }
  };

  const generateTags = async () => {
    setLoadingTags(true);
    const API_KEY = "AIzaSyDRlUUReWOBg7x237Y5WtC0bOyBhyMSrUw"; // Replace with your actual API key
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: `Generate tags based on the following information: Name: ${name}, Info: ${info}, Business Type: ${businessType}, Industry: ${industrySector}, Additional Notes: ${additionalNotes} THE TAGS MUST BE IN # FORMAT WITH A COMMA AND A SPACE SEPERATING EACH. FOR EXAMPLE, #sample1, #sample2, #sample3, #sample4 ` }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 50 }
      });

      const generatedTags = result.response.text().split(',').map(tag => tag.trim()).join(', ');
      setData((prev) => ({ ...prev, tags: generatedTags }));
    } catch (error) {
      console.error("Error generating tags: ", error);
    } finally {
      setLoadingTags(false);
    }
  };

  return (
    <div className="ml-64 p-8">
      <Grid centered verticalAlign='middle' columns="3" style={{ height: "80vh" }}>
        <Grid.Row>
          <Grid.Column textAlign='center'>
            <div>
              {isSubmit ? <Loader active inline="centered" size="huge" /> : (
                <>
                  <h2>{id ? "Update Business" : "Add Business"}</h2>
                  <Form onSubmit={handleSubmit}>
                    <Form.Input
                      label="Name"
                      type="text"
                      name="name"
                      value={name}
                      onChange={handleChange}
                      error={errors.name ? { content: errors.name } : null}
                    />
                    <Form.Input
                      label="Email"
                      type="email"
                      name="email"
                      value={email}
                      onChange={handleChange}
                      error={errors.email ? { content: errors.email } : null}
                    />
                    <Form.TextArea
                      label="Info"
                      name="info"
                      value={info}
                      onChange={handleChange}
                      error={errors.info ? { content: errors.info } : null}
                    />
                    <Form.Input
                      label="Contact"
                      type="text"
                      name="contact"
                      value={contact}
                      onChange={handleChange}
                      error={errors.contact ? { content: errors.contact } : null}
                    />
                    <Form.Input
                      label="Latitude"
                      type="text"
                      name="latitude"
                      value={latitude}
                      onChange={handleChange}
                      error={errors.latitude ? { content: errors.latitude } : null}
                    />
                    <Form.Input
                      label="Longitude"
                      type="text"
                      name="longitude"
                      value={longitude}
                      onChange={handleChange}
                      error={errors.longitude ? { content: errors.longitude } : null}
                    />
                    <Form.Input
                      label="Business Type"
                      type="text"
                      name="businessType"
                      value={businessType}
                      onChange={handleChange}
                      error={errors.businessType ? { content: errors.businessType } : null}
                    />
                    <Form.Input
                      label="Industry Sector"
                      type="text"
                      name="industrySector"
                      value={industrySector}
                      onChange={handleChange}
                      error={errors.industrySector ? { content: errors.industrySector } : null}
                    />
                    <Form.Input
                      label="Website"
                      type="text"
                      name="website"
                      value={website}
                      onChange={handleChange}
                      error={errors.website ? { content: errors.website } : null}
                    />
                    <Form.Input
                      label="Organization Size"
                      type="text"
                      name="organizationSize"
                      value={organizationSize}
                      onChange={handleChange}
                      error={errors.organizationSize ? { content: errors.organizationSize } : null}
                    />
                    <Form.Input
                      label="Availability"
                      type="text"
                      name="availability"
                      value={availability}
                      onChange={handleChange}
                      error={errors.availability ? { content: errors.availability } : null}
                    />
                    <Form.TextArea
                      label="Additional Notes/Description"
                      name="additionalNotes"
                      value={additionalNotes}
                      onChange={handleChange}
                      error={errors.additionalNotes ? { content: errors.additionalNotes } : null}
                                    />
                     <Form.Input
                      label="Upload"
                      type="file" 
                      onChange={(e) => setFile(e.target.files[0])} 
                  />
                <div className="flex items-center">
                  <Form.Input
                    className="!inline !flex-grow"
                    label="Tags"
                    type="text"
                    name="tags"
                    value={tags}
                    onChange={handleChange}
                    error={errors.tags ? { content: errors.tags } : null}
                  />
                  
                  <button
                    className="btn btn-primary ml-2 !mt-3"
                    type="button"
                    onClick={generateTags}
                    disabled={loadingTags}
                  >
                    
                    <Magicpen size="16" color="#fff" variant="Bold"/>
                    {loadingTags ? 'Loading...' : 'Generate Tags'}
                  </button>
                  
                </div>
                    <button className='btn btn-primary' type="submit">{id ? "Update" : "Add"} Business</button>
                   
                  </Form>
                  
                </>
              )}
            </div>
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </div>
  );
};

export default AddEditUser;
