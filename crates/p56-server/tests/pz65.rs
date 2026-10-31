use p56_core::{transcode, Config, FanType, Link, Placement};
use p56_sim::{Sim, SimConfig};
use std::net::Ipv4Addr;
use std::time::{Duration, Instant};

// Only loopback, random ports; this test never discovers or controls real hardware.
#[test]
fn pz65_upload_stores_repeated_video_without_power_cycle_and_uses_actual_slot() {
    let (link, _rx) = Link::start(Config { local_ip: Some(Ipv4Addr::LOCALHOST), tcp_port: 0, udp_port: 0, broadcast: false, ..Default::default() }).unwrap();
    let pc = (Ipv4Addr::LOCALHOST, link.tcp_port).into();
    let sims: Vec<_> = p56_core::pz65::DEVICES
        .iter()
        .enumerate()
        .map(|(i, name)| {
            Sim::start(SimConfig {
                name: name.to_string(),
                fan_type: 26,
                pc: Some(pc),
                pc_port: link.tcp_port,
                udp_port: 0,
                ip: Ipv4Addr::LOCALHOST,
                mac: [2, 0, 0, 0, 0, i as u8],
                ..Default::default()
            })
            .unwrap()
        })
        .collect();
    let by = Instant::now() + Duration::from_secs(8);
    while link.devices().iter().filter(|d| d.info.is_some() && d.status.is_some()).count() != 3 {
        assert!(Instant::now() < by, "three virtual PZ65s did not connect");
        std::thread::sleep(Duration::from_millis(30));
    }
    let main = link.devices().into_iter().find(|d| d.info.as_ref().unwrap().name == p56_core::pz65::MAIN).unwrap().id;
    let replica = link.ids().into_iter().find(|id| *id != main).unwrap();
    let ft = FanType::usable(26).unwrap();
    let frame = transcode::encode_upload(&transcode::test_card(), &ft, &Placement::default()).jpeg;
    assert!(link.upload(replica, std::slice::from_ref(&frame), "12340001", None).is_err());
    let r = link.upload(main, std::slice::from_ref(&frame), "12340001", None).unwrap();
    assert!(r.listed);
    let r = link.upload(main, std::slice::from_ref(&frame), "12340002", Some(1)).unwrap();
    assert!(r.listed);
    let state = sims[0].state();
    assert_eq!(state.current, 2, "select newly appended slot, not requested old slot 1");
    assert_eq!(state.files[1].frames, 100);
    assert!(!state.repeat_all);
    assert_eq!(state.brightness, 16);
    assert_eq!(state.angle, 180);
    assert!(state.errors().is_empty(), "{:?}", state.errors());
    assert!(!state.commands.iter().any(|c| matches!(c.as_str(), "on" | "off" | "format" | "reset" | "angle" | "delete")));
    assert_eq!(state.commands.iter().filter(|c| c.as_str() == "commit").count(), 2);
    assert!(link.upload(main, &[frame], "12340002", None).is_err(), "duplicate must be refused");
    for sim in sims {
        sim.stop();
    }
    link.shutdown();
}
