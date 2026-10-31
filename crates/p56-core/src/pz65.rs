//! PZ65 upload profile, from the successful native-capture comparison on 2026-10-28.
//! Kept separate from the upstream P56 upload (different commit/playback contract).
use crate::{protocol, Error};

pub const MAIN: &str = "3D-PZ65-2048*1576-06272470";
pub const DEVICES: [&str; 3] = [MAIN, "3D-PZ65-2048*1576-25057492", "3D-PZ65-2048*1576-29676722"];

pub struct Plan {
    pub bytes: Vec<u8>,
    pub frames: usize,
}

pub fn plan(frames: &[Vec<u8>], audio: Option<&[u8]>) -> Result<Plan, Error> {
    if frames.is_empty() || frames.len() > 1200 {
        return Err(Error::Invalid("PZ65: use 1..1200 frames (at most 60 seconds)".into()));
    }
    for f in frames {
        if f.len() > protocol::MAX_UPLOAD_JPEG || !protocol::jpeg_complete(f) {
            return Err(Error::Invalid("PZ65: incomplete/oversize JPEG".into()));
        }
        let d = image::load_from_memory(f)?;
        if d.width() != 512 || d.height() != 512 {
            return Err(Error::Invalid("PZ65: JPEG must be 512x512".into()));
        }
    }
    // The single-frame still flag is not verified on PZ65. Use a 5-second video.
    let expanded;
    let frames = if frames.len() == 1 {
        expanded = vec![frames[0].clone(); 100];
        &expanded[..]
    } else {
        frames
    };
    let (head, body) = protocol::upload_blob_with_audio(frames, audio);
    let mut bytes = head;
    bytes.extend_from_slice(&body);
    Ok(Plan { bytes, frames: frames.len() })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn repeated_video_matches_native_record_contract() {
        let jpeg = crate::transcode::jpeg(&image::RgbImage::new(512, 512), 80);
        let p = plan(std::slice::from_ref(&jpeg), None).unwrap();
        assert_eq!(p.frames, 100);
        assert_eq!(u32::from_le_bytes(p.bytes[..4].try_into().unwrap()), 5000);
        let len = 1600 + (jpeg.len() & !3) + 4;
        assert_eq!(p.bytes.len(), 4 + 100 * (4 + len));
        for record in p.bytes[4..].chunks_exact(4 + len) {
            assert_eq!(u32::from_le_bytes(record[..4].try_into().unwrap()) as usize, len);
            assert!(record[4..1604].iter().all(|b| *b == 0));
            assert_eq!(&record[1604..1604 + jpeg.len()], jpeg.as_slice());
            assert!(record[1604 + jpeg.len()..].iter().all(|b| *b == 0));
        }
        assert_eq!(protocol::commit_with(0), [0x5a, 0x91, 0, 0, 0, 0, 0, 0xf5]);
    }
    #[test]
    fn wrong_model_geometry_and_empty_input_are_refused() {
        let jpeg = crate::transcode::jpeg(&image::RgbImage::new(688, 240), 80);
        assert!(plan(&[jpeg], None).is_err());
        assert!(plan(&[], None).is_err());
    }
}
